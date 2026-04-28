# ATS Matcher - AWS Infrastructure & Deployment

---

**See also:**

- [Project Setup & Running Guide (README.md)](./README.md)
- [architectural decision Overview (architectural_decision.md)](./architectural_decision.md)

This repository contains the infrastructure-as-code for deploying the ATS Matcher backend to AWS using Terraform and GitHub Actions for CI/CD.

## 🌍 Hosting Strategy

- **AWS** is the primary hosting platform for production deployments of the backend and infrastructure. Use AWS for scaling, reliability, and mainline traffic.
- A backup/test server for the backend is deployed on **Render**. This environment is used for cost-effective testing, staging, and backup purposes.
- Render is not intended for production-scale workloads but is useful for development, QA, and as a fallback during AWS maintenance or cost management.

### Deployment Strategy

- Deploy to AWS for production and high-availability needs.
- Use Render for:
  - Testing new features
  - Staging environments
  - Cost management during low-traffic periods
  - Backup/failover if AWS is unavailable

Monitor usage and costs on both platforms. Switch primary traffic to AWS as the project scales or for production launches. Keep Render deployments up-to-date with mainline code for seamless failover/testing.

---

## 🏗️ Architecture Overview

The infrastructure consists of:

- **VPC** with public and private subnets across 2 availability zones
- **ECS Fargate** for containerized application deployment
- **RDS PostgreSQL** for database storage
- **Application Load Balancer** for traffic distribution
- **ECR** for Docker image storage
- **Secrets Manager** for sensitive configuration
- **CloudWatch** for logging and monitoring

## 📁 Project Structure

```
├── terraform/                 # Infrastructure as Code
│   ├── main.tf               # Main Terraform configuration
│   ├── variables.tf          # Input variables
│   ├── vpc.tf                # VPC, subnets, and networking
│   ├── security.tf           # Security groups
│   ├── rds.tf                # PostgreSQL database
│   ├── ecr.tf                # Container registry
│   ├── iam.tf                # IAM roles and policies
│   ├── ecs.tf                # ECS cluster and service
│   ├── alb.tf                # Application Load Balancer
│   ├── secrets.tf            # AWS Secrets Manager
│   └── outputs.tf            # Terraform outputs
├── backend/                  # Flask application
│   ├── Dockerfile           # Container definition
│   └── ...                  # Application code
├── scripts/                  # Deployment scripts
│   ├── check-db.sh          # Database readiness check
│   └── init-db.sh           # Database schema initialization
└── .github/workflows/       # CI/CD pipelines
    ├── deploy.yml          # Deployment workflow
    └── destroy.yml         # Infrastructure cleanup
```

## 🗄️ Database Setup

The application uses **PostgreSQL** as its database backend. The deployment process includes:

### Database Provisioning

- **RDS PostgreSQL** instance created via Terraform
- Database credentials stored securely in AWS Secrets Manager
- Automatic backup configuration (7-day retention)
- Multi-AZ deployment for high availability

### Schema Initialization

- Database tables created automatically on first deployment
- Idempotent schema creation (safe to run multiple times)
- Includes users, usage tracking, and related tables
- Indexes created for optimal query performance

### Deployment Flow

1. **Infrastructure Creation**: VPC, subnets, security groups, RDS
2. **Database Readiness**: Wait for RDS to be fully available
3. **Schema Initialization**: Create tables and indexes
4. **Application Deployment**: Build and deploy Flask app
5. **Health Checks**: Verify application and database connectivity

## 🚀 Quick Start

### Prerequisites

1. **AWS Account** with appropriate permissions
2. **GitHub Repository** with secrets configured
3. **Terraform** installed locally (for manual deployment)
4. **AWS CLI** configured

### 1. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

```bash
# AWS Credentials
AWS_ACCESS_KEY        # Your AWS access key
AWS_SECRET_KEY        # Your AWS secret key
AWS_REGION           # AWS region (e.g., eu-west-2)

# Application Configuration
APP_NAME             # Application name (e.g., ats-matcher-backend)

# Database Credentials
DB_USERNAME          # RDS username
DB_PASSWORD          # RDS password
DB_NAME             # Database name (e.g., ats_matcher)

# API Keys (to be added to Secrets Manager)
JWT_SECRET_KEY       # JWT secret for authentication
GEMINI_API_KEY       # Google Gemini API key
PAYSTACK_SECRET_KEY  # Paystack secret key
PAYSTACK_PK_KEY      # Paystack public key
PAYPAL_CLIENT_ID     # PayPal client ID
PAYPAL_CLIENT_SECRET # PayPal client secret
```

### 2. Configure Terraform Backend (Optional)

For production deployments, configure remote state storage:

```hcl
# terraform/main.tf - Uncomment and configure backend block
backend "s3" {
  bucket = "your-terraform-state-bucket"
  key    = "ats-matcher/terraform.tfstate"
  region = "eu-west-2"
}
```

### 3. Deploy Infrastructure

#### Option A: Automatic Deployment (Recommended)

Push to the main branch to trigger automatic deployment:

```bash
git add .
git commit -m "Deploy infrastructure"
git push origin main
```

#### Option B: Manual Deployment

```bash
# Navigate to terraform directory
cd terraform

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the infrastructure
terraform apply
```

### 4. Configure Secrets

After infrastructure creation, populate AWS Secrets Manager:

```bash
# Example: Set JWT secret
aws secretsmanager put-secret-value \
  --secret-id "ats-matcher-backend/jwt-secret-key" \
  --secret-string "your-jwt-secret-here"
```

Repeat for all required secrets listed in `secrets.tf`.

## 🔧 Configuration

### Environment Variables

The application uses the following environment variables:

| Variable               | Source          | Description                  |
| ---------------------- | --------------- | ---------------------------- |
| `DATABASE_URL`         | Terraform       | PostgreSQL connection string |
| `JWT_SECRET_KEY`       | Secrets Manager | Authentication secret        |
| `GEMINI_API_KEY`       | Secrets Manager | AI service API key           |
| `PAYSTACK_SECRET_KEY`  | Secrets Manager | Payment processor secret     |
| `PAYSTACK_PK_KEY`      | Secrets Manager | Payment processor public key |
| `PAYPAL_CLIENT_ID`     | Secrets Manager | PayPal client ID             |
| `PAYPAL_CLIENT_SECRET` | Secrets Manager | PayPal client secret         |

### Resource Sizing

Default resource allocation (configurable in `variables.tf`):

- **ECS**: 256 CPU, 512 MB RAM, 1 desired task
- **RDS**: db.t3.micro, 20GB storage
- **VPC**: 2 availability zones, public/private subnets

## 📊 Monitoring & Logging

### CloudWatch Logs

Application logs are available in CloudWatch:

- **Log Group**: `/ecs/ats-matcher-backend`
- **Log Stream**: `ecs/ats-matcher-backend-service`

### Health Checks

- **Application**: `/health` endpoint
- **Load Balancer**: HTTP health checks on port 5000
- **ECS**: Service health monitoring

### Metrics

Monitor these key metrics:

- ECS CPU/Memory utilization
- RDS connections and performance
- ALB request count and latency
- Application response times

## 🔄 CI/CD Pipeline

### Deployment Flow

1. **Trigger**: Push to `main` branch or manual dispatch
2. **Infrastructure**: Terraform creates/updates AWS resources
3. **Build**: Docker image built from `backend/Dockerfile`
4. **Push**: Image pushed to ECR repository
5. **Deploy**: ECS service updated with new image
6. **Health Check**: Wait for service stability

### Rollback

To rollback to a previous version:

```bash
# Get previous image tag
aws ecr list-images --repository-name ats-matcher-backend

# Update ECS service
aws ecs update-service \
  --cluster ats-matcher-backend-cluster \
  --service ats-matcher-backend-service \
  --force-new-deployment \
  --task-definition "previous-task-definition-arn"
```

## 🧹 Cleanup

### Destroy Infrastructure

#### Option A: GitHub Action

Use the "Destroy Infrastructure" workflow from GitHub Actions.

#### Option B: Manual

```bash
cd terraform
terraform destroy
```

**⚠️ Warning**: This will permanently delete all resources and data.

## 🐛 Troubleshooting

### Common Issues

1. **ECS Service Won't Start**
   - Check CloudWatch logs for application errors
   - Verify secrets are populated in Secrets Manager
   - Ensure database is accessible from ECS tasks

2. **Database Connection Issues**
   - Verify security group rules allow ECS to RDS communication
   - Check database credentials and endpoint
   - Ensure RDS instance is in the same VPC
   - Confirm database schema has been initialized

3. **Database Schema Issues**
   - Check if tables were created during deployment
   - Verify database migration scripts ran successfully
   - Review application logs for database-related errors

4. **Load Balancer Health Checks Failing**
   - Verify application responds to `/health` endpoint
   - Check ECS task network configuration
   - Review security groups for ALB to ECS communication

### Database-Specific Debugging

```bash
# Check database status
aws rds describe-db-instances --db-instance-identifier ats-matcher-backend-db --query 'DBInstances[0].DBInstanceStatus'

# Test database connectivity from ECS
aws ecs execute-command \
  --cluster ats-matcher-backend-cluster \
  --task $(aws ecs list-tasks --cluster ats-matcher-backend-cluster --query 'taskArns[0]' --output text) \
  --container atsmatcher-backend \
  --interactive \
  --command "/bin/bash"

# Check database tables exist
psql -h $(terraform output -raw rds_endpoint) -U ${{ secrets.DB_USERNAME }} -d ${{ secrets.DB_NAME }} -c "\dt"

# View database connection logs
aws logs filter-log-events --log-group-name /ecs/ats-matcher-backend --filter-pattern "database"
```

### Debugging Commands

```bash
# Check ECS service status
aws ecs describe-services --cluster ats-matcher-backend-cluster --services ats-matcher-backend-service

# View application logs
aws logs tail /ecs/ats-matcher-backend --follow

# Check RDS connectivity
aws rds describe-db-instances --db-instance-identifier ats-matcher-backend-db

# Test application endpoint
curl http://your-alb-dns-name/health
```

## 🔒 Security Considerations

- **Secrets Management**: All sensitive data stored in AWS Secrets Manager
- **Network Security**: Application in private subnets, ALB in public subnets
- **IAM**: Least-privilege access for ECS tasks
- **Database**: No public access, encrypted storage
- **Container Security**: Non-root user, minimal base image

## 📈 Scaling

### Horizontal Scaling

Increase desired task count:

```bash
aws ecs update-service \
  --cluster ats-matcher-backend-cluster \
  --service ats-matcher-backend-service \
  --desired-count 3
```

### Vertical Scaling

Update task definition with higher CPU/memory:

```hcl
# terraform/variables.tf
cpu    = 512  # Increase from 256
memory = 1024 # Increase from 512
```

### Database Scaling

Upgrade RDS instance class:

```hcl
# terraform/variables.tf
db_instance_class = "db.t3.small" # Increase from micro
```

## 🤝 Contributing

1. Create a feature branch
2. Make infrastructure changes
3. Test locally with `terraform plan`
4. Create a pull request
5. CI/CD will validate and deploy changes

## 📚 Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest)
- [GitHub Actions for AWS](https://github.com/aws-actions/)
- [Flask Deployment Best Practices](https://flask.palletsprojects.com/en/2.3.x/deploying/)

---

**Application URL**: After deployment, access your application at the ALB DNS name provided in Terraform outputs.</content>
<parameter name="filePath">c:\Dev\genAI\ats-matcher\INFRASTRUCTURE_README.md
