"""
Authentication utilities and routes for ATS Matcher Backend (PostgreSQL + bcrypt)
"""

import jwt
from logger.app_logger import logger, log_auth_event
import datetime
import secrets
import bcrypt
from functools import wraps
from flask import request, jsonify, g
from db.database import get_db
from config import JWT_SECRET_KEY


# SECURE PASSWORD HASHING
def hash_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    return hashed.decode()


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def generate_token(user_id, email):
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
        "iat": datetime.datetime.utcnow(),
    }
    logger.debug(f"Generated token for user {user_id} ({email})")
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm="HS256")


def verify_token(token):
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        logger.debug(f"Token verified for user {payload.get('user_id')}")
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("Token verification failed: expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Token verification failed: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Token verification error: {str(e)}")
        return None


def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None

        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            logger.warning(f"Missing token for {request.method} {request.path}")
            return jsonify({"error": "Token is missing"}), 401

        payload = verify_token(token)
        if not payload:
            logger.warning(f"Invalid/expired token for {request.method} {request.path}")
            return jsonify({"error": "Token is invalid or expired"}), 401

        try:
            user_id = int(payload.get("user_id"))
        except:
            logger.warning(f"Invalid token payload for {request.method} {request.path}")
            return jsonify({"error": "Invalid token payload"}), 401

        db = get_db()
        cursor = db.cursor()

        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()

        if user is None:
            logger.warning(
                f"User {user_id} not found for {request.method} {request.path}"
            )
            return jsonify({"error": "User not found"}), 401

        g.user = user
        g.user_id = user["id"]
        g.user_email = user["email"]

        return f(*args, **kwargs)

    return decorated_function


def admin_required(f):
    """Decorator that requires admin role."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None

        if "Authorization" in request.headers:
            auth_header = request.headers["Authorization"]
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]

        if not token:
            logger.warning(
                f"Missing token for admin route {request.method} {request.path}"
            )
            return jsonify({"error": "Token is missing"}), 401

        payload = verify_token(token)
        if not payload:
            logger.warning(
                f"Invalid/expired token for admin route {request.method} {request.path}"
            )
            return jsonify({"error": "Token is invalid or expired"}), 401

        try:
            user_id = int(payload.get("user_id"))
        except:
            return jsonify({"error": "Invalid token payload"}), 401

        db = get_db()
        cursor = db.cursor()

        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()

        if user is None:
            logger.warning(f"Admin user {user_id} not found")
            return jsonify({"error": "User not found"}), 401

        # Check for admin role
        if user.get("role") != "admin":
            logger.warning(
                f"Non-admin user {user_id} attempted to access admin route {request.path}"
            )
            return jsonify({"error": "Admin access required"}), 403

        g.user = user
        g.user_id = user["id"]
        g.user_email = user["email"]

        logger.debug(f"Admin access granted for user {user_id} to {request.path}")

        return f(*args, **kwargs)

    return decorated_function


def register_auth_routes(app):
    @app.route("/api/auth/register", methods=["POST"])
    def register():
        try:
            data = request.get_json()

            if (
                not data
                or not data.get("email")
                or not data.get("password")
                or not data.get("name")
            ):
                logger.warning("Registration attempt with missing fields")
                return jsonify({"error": "Email, password, and name are required"}), 400

            email = data["email"].strip().lower()
            password = data["password"]
            name = data["name"].strip()

            if len(password) < 6:
                logger.warning(f"Registration attempt with short password for {email}")
                return jsonify(
                    {"error": "Password must be at least 6 characters long"}
                ), 400

            db = get_db()
            cursor = db.cursor()

            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cursor.fetchone():
                log_auth_event(
                    "register",
                    user_email=email,
                    success=False,
                    details="User already exists",
                )
                return jsonify({"error": "User already exists"}), 409

            password_hash = hash_password(password)

            cursor.execute(
                """
                INSERT INTO users (email, password_hash, name, subscription_type)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (email, password_hash, name, "free"),
            )

            user_id = cursor.fetchone()["id"]
            db.commit()

            token = generate_token(user_id, email)

            log_auth_event("register", user_email=email, user_id=user_id, success=True)
            logger.info(f"New user registered: {email} (ID: {user_id})")

            return jsonify(
                {
                    "message": "User registered successfully",
                    "token": token,
                    "user": {
                        "id": user_id,
                        "email": email,
                        "name": name,
                        "subscription_type": "free",
                        "subscription_expires_at": None,
                    },
                }
            ), 201

        except Exception as e:
            logger.error(f"Registration error: {e}")
            return jsonify({"error": "Internal server error"}), 500

    @app.route("/api/auth/login", methods=["POST"])
    def login():
        try:
            data = request.get_json()

            if not data or not data.get("email") or not data.get("password"):
                logger.warning("Login attempt with missing credentials")
                return jsonify({"error": "Email and password are required"}), 400

            email = data["email"].strip().lower()
            password = data["password"]

            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                """
                SELECT id, email, password_hash, name, subscription_type, subscription_expires_at
                FROM users WHERE email = %s
                """,
                (email,),
            )

            user = cursor.fetchone()

            # bcrypt comparison
            if not user or not check_password(password, user["password_hash"]):
                log_auth_event(
                    "login",
                    user_email=email,
                    success=False,
                    details="Invalid credentials",
                )
                return jsonify({"error": "Invalid email or password"}), 401

            token = generate_token(user["id"], user["email"])

            log_auth_event("login", user_email=email, user_id=user["id"], success=True)
            logger.info(f"User logged in: {email} (ID: {user['id']})")

            return jsonify(
                {"message": "Login successful", "token": token, "user": user}
            ), 200

        except Exception as e:
            logger.error(f"Login error: {e}")
            return jsonify({"error": "Internal server error"}), 500

    @app.route("/api/auth/verify", methods=["GET"])
    @token_required
    def verify_token_endpoint():
        logger.debug(f"Token verified for user {g.user['id']}")
        return jsonify(
            {
                "valid": True,
                "user": {
                    "id": g.user["id"],
                    "email": g.user["email"],
                    "name": g.user["name"],
                    "role": g.user.get("role", "admin"),
                    "subscription_type": g.user["subscription_type"],
                    "subscription_expires_at": g.user["subscription_expires_at"],
                },
            }
        ), 200

    @app.route("/api/auth/logout", methods=["POST"])
    @token_required
    def logout():
        logger.info(f"User logged out: {g.user_email} (ID: {g.user_id})")
        return jsonify({"message": "Logged out successfully"}), 200

    @app.route("/api/auth/forgot-password", methods=["POST"])
    def forgot_password():
        try:
            data = request.get_json()
            if not data or not data.get("email"):
                return jsonify({"error": "Email is required"}), 400

            email = data["email"].strip().lower()

            db = get_db()
            cursor = db.cursor()

            cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
            user = cursor.fetchone()

            if not user:
                return jsonify(
                    {"message": "If the email exists, a reset link has been sent."}
                ), 200

            reset_token = secrets.token_urlsafe(32)
            reset_expires = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

            cursor.execute(
                """
                UPDATE users
                SET reset_token = %s, reset_expires = %s
                WHERE id = %s
                """,
                (reset_token, reset_expires, user["id"]),
            )
            db.commit()

            logger.info(f"Reset token: {reset_token}")

            return jsonify(
                {"message": "If the email exists, a reset link has been sent."}
            ), 200

        except Exception as e:
            logger.error(f"Forgot password error: {e}")
            return jsonify({"error": "Internal server error"}), 500

    @app.route("/api/auth/reset-password", methods=["POST"])
    def reset_password():
        try:
            data = request.get_json()

            if not data or not data.get("token") or not data.get("new_password"):
                return jsonify({"error": "Token and new password are required"}), 400

            token = data["token"]
            new_password = data["new_password"]

            if len(new_password) < 6:
                return jsonify({"error": "Password too short"}), 400

            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                """
                SELECT id FROM users
                WHERE reset_token = %s AND reset_expires > %s
                """,
                (token, datetime.datetime.utcnow()),
            )

            user = cursor.fetchone()

            if not user:
                return jsonify({"error": "Invalid or expired token"}), 400

            cursor.execute(
                """
                UPDATE users
                SET password_hash = %s, reset_token = NULL, reset_expires = NULL
                WHERE id = %s
                """,
                (hash_password(new_password), user["id"]),
            )

            db.commit()

            return jsonify({"message": "Password reset successful"}), 200

        except Exception as e:
            logger.error(f"Reset password error: {e}")
            return jsonify({"error": "Internal server error"}), 500
