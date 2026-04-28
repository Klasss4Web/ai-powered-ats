# ATS Matcher - Project Setup & Running Guide

This guide explains how to set up, run, and develop the ATS Matcher application (backend + frontend) locally and in production.

---

## 🏗️ Project Structure

- `backend/` — Python Flask API (core logic, authentication, payments, resume parsing)
- `client/` — React frontend (user interface)
- `terraform/` — Infrastructure as Code (AWS)
- `scripts/` — Helper scripts (DB init, checks, deployment)

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

- Copy `.env` files in `backend/` and `client/` (see `.env` samples)
- Set all required secrets (DB, API keys, JWT, etc.)

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

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET_KEY` — JWT signing key
- `GEMINI_API_KEY`, `OPENAI_API_KEY`, etc. — AI/ML API keys
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PK_KEY` — Payment provider keys
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` — PayPal keys
- `PAYSTACK_CALLBACK_URL` — Payment callback URL
- See `backend/.env` for all required variables

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

---

## 📞 Support

For issues, open an issue in this repo or contact the maintainer.
