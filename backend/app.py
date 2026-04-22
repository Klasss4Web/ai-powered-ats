"""
ATS Matcher Backend - Main Application Entry Point

This application provides API endpoints for resume matching with AI-powered analysis.
It includes authentication, payment processing, usage tracking, and resume management.

To run: python app.py
Backend server will run on port 5000
"""

from flask import Flask, g, jsonify
from flask_cors import CORS

# Import configuration
from config import DATABASE
from database import init_db, close_db_connection, get_db

# Import route modules
from auth import register_auth_routes, token_required
from payment import register_payment_routes
from usage import register_usage_routes
from resume import register_resume_routes
# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Allow all origins for development purposes


# Database setup
@app.teardown_appcontext
def close_connection(exception):
    """Close database connection."""
    close_db_connection(app)(exception)


# Register all routes
def register_routes(app):
    """Register all route blueprints."""
    register_auth_routes(app)
    register_payment_routes(app)
    register_usage_routes(app)
    register_resume_routes(app)


# Health and index endpoints
@app.route('/', methods=['GET'])
def index():
    """Basic landing page so visiting root doesn't return 404."""
    return (
        '<h2>ATS Matcher Backend</h2>'
        '<p>Available endpoints:</p>'
        '<ul>'
        '<li>POST <code>/api/match</code> - Upload resume (file) and job_description (form field)</li>'
        '<li>POST <code>/api/payment/initialize</code> - Initialize payment transaction</li>'
        '<li>GET <code>/api/payment/verify/&lt;reference&gt;</code> - Verify payment transaction</li>'
        '<li>GET <code>/api/payment/config</code> - Get payment configuration</li>'
        '<li>GET <code>/health</code> - Health check</li>'
        '</ul>'
    )


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    # Initialize the database
    init_db(app)
    
    # Register all routes
    register_routes(app)

    # Ensure you set GEMINI_API_KEY environment variable first!
    # To run: python app.py
    # This will run the backend server on port 5000
    app.run(debug=False, port=5000)