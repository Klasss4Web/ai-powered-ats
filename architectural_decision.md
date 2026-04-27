# Architectural Decisions & Rationales

This document outlines the key architectural decisions made for the ATS Matcher project, along with the rationale for each choice and alternatives considered.

---

## 1. **Backend Framework: Flask (Python)**

- **Decision:** Use Flask for the backend API.
- **Rationale:**
  - Lightweight, flexible, and easy to extend for REST APIs.
  - Large ecosystem and community support.
  - Simple integration with AI/ML libraries (OpenAI, Gemini, etc.).
  - Fast prototyping and clear code structure.
- **Alternatives Considered:**
  - **FastAPI:** More modern, async support, but Flask was preferred for team familiarity and maturity.
  - **Django:** More opinionated/monolithic, unnecessary for a lightweight API.

---

## 2. **Frontend Framework: React + Vite**

- **Decision:** Use React with Vite for the frontend.
- **Rationale:**
  - React is widely adopted, component-driven, and has a large talent pool.
  - Vite offers fast development server and build times.
  - Easy integration with modern UI libraries and routing.
- **Alternatives Considered:**
  - **Next.js:** Considered for SSR, but Vite + React was simpler for SPA needs.
  - **Vue/Angular:** Team expertise and ecosystem favored React.

---

## 3. **Database: PostgreSQL (Managed/Cloud or Local)**

- **Decision:** Use PostgreSQL for all environments.
- **Rationale:**
  - Reliable, open-source, and feature-rich (JSONB, full-text search, etc.).
  - Well-supported by cloud providers (AWS RDS, Render, etc.).
  - Strong transactional guarantees and scalability.
- **Alternatives Considered:**
  - **MySQL:** Similar, but PostgreSQL offers better extensibility and standards compliance.
  - **NoSQL (MongoDB, DynamoDB):** Not chosen due to strong relational/data integrity needs.

---

## 4. **Infrastructure: AWS + Terraform**

- **Decision:** Use AWS for cloud hosting, managed via Terraform.
- **Rationale:**
  - AWS provides robust, scalable services (ECS, RDS, S3, etc.).
  - Terraform enables reproducible, version-controlled infrastructure.
  - Easy integration with CI/CD and secrets management.
- **Alternatives Considered:**
  - **Azure/GCP:** AWS chosen for team experience and service maturity.
  - **CloudFormation:** Terraform preferred for multi-cloud flexibility and better syntax.

---

## 5. **Containerization: Docker + ECS Fargate**

- **Decision:** Containerize backend with Docker, deploy on ECS Fargate.
- **Rationale:**
  - Simplifies deployment and scaling.
  - Fargate removes server management overhead.
  - Consistent environments from dev to prod.
- **Alternatives Considered:**
  - **Kubernetes (EKS):** More complex, not needed for current scale.
  - **EC2:** More manual management, less scalable.

---

## 6. **Authentication: JWT**

- **Decision:** Use JWT for stateless authentication.
- **Rationale:**
  - Works well for SPAs and APIs.
  - Easy to integrate with frontend and mobile clients.
  - Supports scalable, stateless sessions.
- **Alternatives Considered:**
  - **Session-based auth:** More stateful, less scalable for APIs.

---

## 7. **Payments: Paystack & PayPal**

- **Decision:** Integrate Paystack and PayPal for payment processing.
- **Rationale:**
  - Covers both local (Africa) and international payments.
  - Secure, well-documented APIs.
- **Alternatives Considered:**
  - **Stripe:** Not as widely supported in target regions.

---

## 8. **AI/ML Integration: OpenAI, Gemini APIs**

- **Decision:** Use OpenAI and Gemini APIs for resume parsing and matching.
- **Rationale:**
  - State-of-the-art models for NLP tasks.
  - Managed APIs reduce operational overhead.
- **Alternatives Considered:**
  - **Self-hosted models:** Higher cost and complexity.

---

## 9. **CI/CD: GitHub Actions**

- **Decision:** Use GitHub Actions for CI/CD pipelines.
- **Rationale:**
  - Seamless integration with GitHub repos.
  - Automates testing, building, and deployment.
- **Alternatives Considered:**
  - **Jenkins, CircleCI:** More setup/maintenance, less integrated.

---

## 10. **Secrets Management: .env Files (No AWS Secrets Manager)**

- **Decision:** Use `.env` files for all environments (local, dev, production).
- **Rationale:**
  - AWS Secrets Manager was considered but not used due to additional costs and project budget constraints.
  - `.env` files are simple, familiar, and sufficient for current needs.
  - Secrets are managed securely in deployment pipelines and infrastructure.
- **Alternatives Considered:**
  - **AWS Secrets Manager:** Not used due to cost.
  - **SSM Parameter Store, Vault:** Added complexity, not required for current scale.

---

## 11. **Infrastructure as Code: Terraform**

- **Decision:** Use Terraform for all infrastructure provisioning.
- **Rationale:**
  - Enables reproducible, auditable, and version-controlled infra.
  - Supports modularity and multi-environment setups.
- **Alternatives Considered:**
  - **AWS CloudFormation:** More verbose, less flexible.

---

## 12. **Other Notable Decisions**

- **CORS:** Enabled via Flask-CORS for frontend-backend communication.
- **Gunicorn:** Used as WSGI server for production Python apps.
- **Vite:** Chosen for fast frontend builds and HMR.

---

## 📌 Summary

The architecture prioritizes simplicity, scalability, and developer productivity, using proven technologies and cloud-native patterns. Decisions were made based on team expertise, project requirements, and long-term maintainability.
