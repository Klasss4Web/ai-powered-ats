# ATS Matcher - Project Setup & Running Guide

---

**See also:**

- [Infrastructure & Deployment (infrastructure.md)](./infrastructure.md)
- [architectural decision Overview (architectural_decision.md)](./architectural_decision.md)

This guide explains how to set up, run, and develop the ATS Matcher application (backend + frontend) locally and in production.

---

## 🏗️ Project Structure

- `backend/` — Python Flask API (core logic, authentication, payments, resume parsing)
- `client/` — React frontend (user interface)
- `terraform/` — Infrastructure as Code (AWS)
- `scripts/` — Helper scripts (DB init, checks, deployment)

---

## ✨ Features

### Core Features

- **Resume Analysis** — Upload your resume and job description to get an ATS compatibility score
- **Multi-Metric Scoring** — Detailed scores for keyword match, skills alignment, experience relevance, formatting, and seniority fit
- **Optimized Resume Download** — Generate an AI-optimized resume tailored to the job description (PDF)
- **Cover Letter Generation** — AI-generated personalized cover letters
- **Interview Preparation** — Get likely interview questions and suggested answers based on your resume and the job

### Premium Features

- **Batch Resume Screening** — Recruiters can analyze multiple resumes against a job description
- **Screening Reports** — Generate comprehensive candidate comparison reports
- **Increased Usage Limits** — Premium users get higher daily analysis limits

### Admin Dashboard (`/admin`)

A comprehensive admin panel for monitoring and managing the application:

- **Dashboard Overview** — Key metrics at a glance (users, analyses, API health, token usage)
- **Traffic Analytics** — Daily active users, analysis trends, hourly traffic patterns, top endpoints
- **Token Usage** — Monitor LLM token consumption, costs by endpoint, top users by usage
- **Performance Metrics** — API response times, error rates, slowest endpoints, health insights
- **User Management** — Search, filter, and manage users; assign admin roles
- **Activity Log** — Timeline view of recent user actions

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites

- **Python 3.11+** (for backend)
- **Node.js 18+ & npm** (for frontend)
- **PostgreSQL** (local or cloud)
- **Docker** (optional, for containerized backend)

### 2. Clone the Repository

```sh
git clone <your-repo-url>
cd ats-matcher
```

### 3. Environment Variables

- Copy the provided `.env.example` files to create your own `.env` files in both the `backend/` and `client/` folders:

  ```sh
  cp backend/.env.example backend/.env
  cp client/.env.example client/.env
  ```

  - Update the values in your new `.env` files as needed (e.g., database credentials, API keys, URLs).
  - **Do not commit your `.env` files.** Only `.env.example` should be tracked in git for reference.
  - When adding new environment variables, update the corresponding `.env.example` file so collaborators know what is required.

This approach ensures everyone on the team can quickly set up the correct environment variables and helps avoid missing or misconfigured settings.

---

## 🖥️ Backend (Flask API)

### Install & Run (Locally)

```sh
cd backend
python -m venv .venv
.venv\Scripts\activate  # On Windows
source .venv/bin/activate  # On Mac/Linux
pip install -r requirements.txt
python app.py
```

- The backend runs at: `http://localhost:5000`

### API Endpoints

#### Authentication

- `POST /api/auth/register` — Register a new user
- `POST /api/auth/login` — Login and get JWT token
- `GET /api/auth/verify` — Verify token and get user info
- `POST /api/auth/logout` — Logout
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with token

#### Resume & Analysis

- `POST /api/match` — Analyze resume against job description
- `POST /api/generate-optimized-resume` — Generate AI-optimized resume (PDF)
- `POST /api/generate-cv` — Generate standard formatted resume (PDF)
- `POST /api/generate-cover-letter` — Generate personalized cover letter
- `POST /api/interview-prep` — Generate interview preparation materials
- `GET /api/resumes` — Get saved resumes
- `POST /api/resumes/save` — Save a resume
- `DELETE /api/resumes/:id` — Delete a saved resume

#### Recruiter Features (Premium)

- `POST /api/batch-match` — Batch analyze multiple resumes
- `POST /api/recruiter/report` — Generate screening report
- `POST /api/recruiter/sessions` — Create screening session
- `GET /api/recruiter/sessions` — List screening sessions
- `GET /api/recruiter/sessions/:id` — Get session details
- `DELETE /api/recruiter/sessions/:id` — Delete session

#### Admin Endpoints (Admin role required)

- `GET /api/admin/dashboard` — Dashboard overview statistics
- `GET /api/admin/analytics/traffic` — Traffic analytics
- `GET /api/admin/analytics/tokens` — Token usage analytics
- `GET /api/admin/analytics/performance` — API performance metrics
- `GET /api/admin/users` — List users (paginated, searchable)
- `PUT /api/admin/users/:id/role` — Update user role
- `GET /api/admin/activity` — Recent activity log

### Running Tests & Coverage

All backend tests are in `backend/tests/` and are designed to run without a real database or external services (mocks are used).

To run all tests and see a coverage report:

- On **Windows** (from the backend directory):

  ```sh
  scripts\run_tests.bat

  OR Use the bash command, cd into scripts and run

  bash run_tests.sh
  ```

- On **Linux/macOS/Git Bash** (from the backend directory):
  ```sh
  ./scripts/run_tests.sh
  ```

Or manually:

```sh
.venv\Scripts\activate
.venv\Scripts\python.exe -m coverage run -m unittest discover -s tests
.venv\Scripts\python.exe -m coverage report
```

Add new tests in `backend/tests/`. Each test file should start with `test_`.

---

### Run with Docker

```sh
docker build -t ats-matcher-backend -f ../Dockerfile .
docker run -p 5000:5000 --env-file .env ats-matcher-backend
```

---

## 🌐 Frontend (React)

### Install & Run

```sh
cd client
npm install
npm run dev
```

- The frontend runs at: `http://localhost:5173`

### Frontend Routes

| Route                | Description                       |
| -------------------- | --------------------------------- |
| `/`                  | Home page                         |
| `/matcher`           | ATS Resume Matcher (main feature) |
| `/recruiters`        | Recruiter batch screening view    |
| `/dashboard`         | User dashboard                    |
| `/subscribe`         | Subscription/pricing page         |
| `/admin`             | Admin dashboard (admin only)      |
| `/admin/traffic`     | Traffic analytics                 |
| `/admin/tokens`      | Token usage monitoring            |
| `/admin/performance` | API performance metrics           |
| `/admin/users`       | User management                   |
| `/admin/activity`    | Activity log                      |

---

## 🗄️ Database Setup

- The backend expects a PostgreSQL database (see `backend/.env` for connection string)
- To initialize the schema:
  ```sh
  ./scripts/init-db.sh <db_endpoint:host:port> <db_username> <db_password> <db_name>
  ```
- To check DB readiness:
  ```sh
  ./scripts/check-db.sh <db_endpoint:host:port> <db_username> <db_password> <db_name>
  ```

### Database Schema

The application uses the following tables:

- `users` — User accounts with email, password, subscription info, and role
- `usage_tracking` — Tracks user actions (analyses, payments, etc.)
- `sessions` — User session tokens
- `saved_resumes` — User's saved resume documents
- `screening_sessions` — Recruiter screening sessions
- `api_metrics` — API request metrics (for observability)
- `token_usage` — LLM token consumption tracking

### Setting Up an Admin User

To grant admin access to a user, run this SQL query:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

---

## ☁️ Cloud Deployment (AWS)

- Infrastructure is managed with Terraform (`terraform/`)
- See `INFRASTRUCTURE_README.md` for AWS deployment, ECR, ECS, and CI/CD details
- Main steps:
  1. Configure AWS credentials
  2. `cd terraform && terraform init && terraform apply`
  3. Build and push Docker image (see `backend/docker.md`)
  4. Update ECS service to deploy new backend

---

## 🔑 Environment Variables (Backend)

| Variable                | Description                      |
| ----------------------- | -------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string     |
| `JWT_SECRET_KEY`        | JWT signing key                  |
| `OPENROUTER_API_KEY`    | OpenRouter API key for LLM calls |
| `GEMINI_API_KEY`        | Google Gemini API key (optional) |
| `OPENAI_API_KEY`        | OpenAI API key (optional)        |
| `PAYSTACK_SECRET_KEY`   | Paystack secret key              |
| `PAYSTACK_PK_KEY`       | Paystack public key              |
| `PAYPAL_CLIENT_ID`      | PayPal client ID                 |
| `PAYPAL_CLIENT_SECRET`  | PayPal client secret             |
| `PAYSTACK_CALLBACK_URL` | Payment callback URL             |

See `backend/.env.example` for all required variables.

---

## 🛠️ Useful Scripts

- `./scripts/init-db.sh` — Initialize DB schema
- `./scripts/check-db.sh` — Check DB readiness
- `./scripts/deploy.sh` — (customize for deployment)

---

## 📝 Notes

- For production, always set strong secrets and use managed DBs
- For local dev, you can use the provided `.env` and a local PostgreSQL instance
- For AWS, see `INFRASTRUCTURE_README.md` and `backend/docker.md`
- Admin dashboard is protected and requires `role = 'admin'` in the users table

---

## 📞 Support

For issues, open an issue in this repo or contact the maintainer.

<!-- UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
 -->
