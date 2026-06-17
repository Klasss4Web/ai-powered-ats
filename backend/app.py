"""
ATS Matcher Backend - Main Application Entry Point
"""

import os
from dotenv import load_dotenv

# Load .env before any other imports that depend on env vars
load_dotenv()

import time
from flask import Flask, jsonify, request, g
from flask_cors import CORS

from db import init_db, close_db_connection, create_database_if_not_exists
from db.database import get_db

# Import route modules
from auth.auth import register_auth_routes
from routes.payment import register_payment_routes
from routes.usage import register_usage_routes
from routes.resume import register_resume_routes
from routes.admin import register_admin_routes
from routes.jobs import register_job_routes
from routes.applications import register_application_routes
from routes.features import register_feature_routes

from logger.app_logger import logger


app = Flask(__name__)

# CRIT-3: Restrict CORS to known frontend origins only.
# FRONTEND_URL can be a comma-separated list for multiple origins.
# In production, set FRONTEND_URL to your deployed frontend domain.
_frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
_allowed_origins = [origin.strip() for origin in _frontend_url.split(",")]
# Always include localhost:3000 for local development with CRA / other dev servers
if "http://localhost:3000" not in _allowed_origins:
    _allowed_origins.append("http://localhost:3000")
CORS(app, origins=_allowed_origins, supports_credentials=True)

# CRIT-4: Limit upload size to 5 MB to prevent DoS via large file uploads.
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024  # 5 MB

# Register teardown
app.teardown_appcontext(close_db_connection)


# ---------------------------
# API METRICS MIDDLEWARE
# ---------------------------
@app.before_request
def before_request():
    """Record request start time."""
    g.start_time = time.time()


@app.after_request
def after_request(response):
    """Record API metrics after each request."""
    # Skip static files and health checks
    if request.path in ["/", "/health"] or request.path.startswith("/static"):
        return response

    try:
        # Calculate response time
        response_time_ms = (time.time() - getattr(g, "start_time", time.time())) * 1000

        # Get user ID if authenticated
        user_id = getattr(g, "user_id", None)

        # Get client info
        ip_address = request.remote_addr
        user_agent = request.headers.get("User-Agent", "")[:500]  # Limit length

        # Record to database
        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            """
            INSERT INTO api_metrics (endpoint, method, status_code, response_time_ms, user_id, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
            (
                request.path,
                request.method,
                response.status_code,
                round(response_time_ms, 2),
                user_id,
                ip_address,
                user_agent,
            ),
        )

        db.commit()

    except Exception as e:
        logger.error(f"Failed to record API metrics: {e}")

    return response


with app.app_context():
    init_db(app)
    logger.info("Database initialized successfully.")


def register_routes(app):
    register_auth_routes(app)
    register_payment_routes(app)
    register_usage_routes(app)
    register_resume_routes(app)
    register_admin_routes(app)
    register_job_routes(app)
    register_application_routes(app)
    register_feature_routes(app)


@app.route("/", methods=["GET"])
def index():
    return (
        "<h2>ATS Matcher Backend</h2>"
        "<p>Available endpoints:</p>"
        "<ul>"
        "<li>POST <code>/api/match</code></li>"
        "<li>POST <code>/api/payment/initialize</code></li>"
        "<li>GET <code>/api/payment/verify/&lt;reference&gt;</code></li>"
        "<li>GET <code>/health</code></li>"
        "</ul>"
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


register_routes(app)

if __name__ == "__main__":
    # HIGH-7: init_db is already called at module load above; no need to call it again.
    # HIGH-9: Never hardcode debug=True. Drive it from the environment instead.
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    logger.info("Welcome to ATS Matcher Backend")
    app.run(debug=debug_mode, port=5000)
