"""
ATS Matcher Backend - Main Application Entry Point
"""

from flask import Flask, jsonify
from flask_cors import CORS

from db import init_db, close_db_connection, create_database_if_not_exists

# Import route modules
from auth.auth import register_auth_routes
from routes.payment import register_payment_routes
from routes.usage import register_usage_routes
from routes.resume import register_resume_routes
import os

app = Flask(__name__)
CORS(app)


# Register teardown
app.teardown_appcontext(close_db_connection)

# Startup bootstrap
with app.app_context():
    # if os.getenv("ENV") != "production":
    #     create_database_if_not_exists()
        init_db(app)


def register_routes(app):
    register_auth_routes(app)
    register_payment_routes(app)
    register_usage_routes(app)
    register_resume_routes(app)


@app.route('/', methods=['GET'])
def index():
    return (
        '<h2>ATS Matcher Backend</h2>'
        '<p>Available endpoints:</p>'
        '<ul>'
        '<li>POST <code>/api/match</code></li>'
        '<li>POST <code>/api/payment/initialize</code></li>'
        '<li>GET <code>/api/payment/verify/&lt;reference&gt;</code></li>'
        '<li>GET <code>/health</code></li>'
        '</ul>'
    )


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    init_db(app)
    register_routes(app)

    app.run(debug=True, port=5000)