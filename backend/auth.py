"""
Authentication utilities and routes for ATS Matcher Backend
"""

import hashlib
import jwt
import datetime
import secrets
from functools import wraps
from flask import request, jsonify, g
from database import get_db
from config import JWT_SECRET_KEY


def hash_password(password):
    """Hash password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()


def generate_token(user_id, email):
    """Generate JWT token."""
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24),
        'iat': datetime.datetime.utcnow()
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm='HS256')


def verify_token(token):
    """Verify JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def token_required(f):
    """Decorator to require authentication token."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None

        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Token is missing'}), 401

        payload = verify_token(token)
        if not payload:
            return jsonify({'error': 'Token is invalid or expired'}), 401

        user_id = payload.get('user_id')

        # 🔒 HARD VALIDATION
        try:
            user_id = int(user_id)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid token payload'}), 401

        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            'SELECT * FROM users WHERE id = ?',
            (user_id,)
        )
        user = cursor.fetchone()

        if user is None:
            return jsonify({'error': 'User not found'}), 401

        g.user = dict(user)
        g.user_id = user['id']
        g.user_email = user['email']

        return f(*args, **kwargs)

    return decorated_function


def register_auth_routes(app):
    """Register authentication routes."""

    @app.route('/api/auth/register', methods=['POST'])
    def register():
        """Register a new user."""
        try:
            data = request.get_json()

            if not data or not data.get('email') or not data.get('password') or not data.get('name'):
                return jsonify({'error': 'Email, password, and name are required'}), 400

            email = data['email'].strip().lower()
            password = data['password']
            name = data['name'].strip()

            if len(password) < 6:
                return jsonify({'error': 'Password must be at least 6 characters long'}), 400

            db = get_db()
            cursor = db.cursor()

            # Check if user already exists
            cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
            if cursor.fetchone():
                return jsonify({'error': 'User with this email already exists'}), 409

            # Create new user
            password_hash = hash_password(password)
            cursor.execute(
                'INSERT INTO users (email, password_hash, name, subscription_type) VALUES (?, ?, ?, ?)',
                (email, password_hash, name, 'free')
            )
            user_id = cursor.lastrowid
            db.commit()

            # Generate token
            token = generate_token(user_id, email)

            return jsonify({
                'message': 'User registered successfully',
                'token': token,
                'user': {
                    'id': user_id,
                    'email': email,
                    'name': name,
                    'subscription_type': 'free',
                    'subscription_expires_at': None
                }
            }), 201

        except Exception as e:
            print(f"Registration error: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/auth/login', methods=['POST'])
    def login():
        """Login user."""
        try:
            data = request.get_json()

            if not data or not data.get('email') or not data.get('password'):
                return jsonify({'error': 'Email and password are required'}), 400

            email = data['email'].strip().lower()
            password = data['password']

            db = get_db()
            cursor = db.cursor()

            # Find user
            cursor.execute('SELECT id, email, password_hash, name, subscription_type, subscription_expires_at FROM users WHERE email = ?', (email,))
            user = cursor.fetchone()

            if not user or user['password_hash'] != hash_password(password):
                return jsonify({'error': 'Invalid email or password'}), 401

            # Generate token
            token = generate_token(user['id'], user['email'])

            return jsonify({
                'message': 'Login successful',
                'token': token,
                'user': {
                    'id': user['id'],
                    'email': user['email'],
                    'name': user['name'],
                    'subscription_type': user['subscription_type'],
                    'subscription_expires_at': user['subscription_expires_at']
                }
            }), 200

        except Exception as e:
            print(f"Login error: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/auth/verify', methods=['GET'])
    @token_required
    def verify_token_endpoint():
        """Verify if token is valid."""
        return jsonify({
            'valid': True,
            'user': {
                'id': g.user_id,
                'email': g.user_email
            }
        }), 200

    @app.route('/api/auth/logout', methods=['POST'])
    @token_required
    def logout():
        """Logout user (client-side token removal is main logout mechanism)."""
        return jsonify({'message': 'Logged out successfully'}), 200

    @app.route('/api/auth/forgot-password', methods=['POST'])
    def forgot_password():
        """Send password reset email."""
        try:
            data = request.get_json()
            if not data or not data.get('email'):
                return jsonify({'error': 'Email is required'}), 400

            email = data['email'].strip().lower()

            db = get_db()
            cursor = db.cursor()

            # Find user
            cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
            user = cursor.fetchone()

            if not user:
                # Don't reveal if email exists or not for security
                return jsonify({'message': 'If the email exists, a reset link has been sent.'}), 200

            # Generate reset token
            reset_token = secrets.token_urlsafe(32)
            reset_expires = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

            # Update user with reset token
            cursor.execute('''
                UPDATE users
                SET reset_token = ?, reset_expires = ?
                WHERE id = ?
            ''', (reset_token, reset_expires.isoformat(), user['id']))
            db.commit()

            # In a real app, send email here
            print(f"Password reset token for {email}: {reset_token}")
            print(f"Reset link: http://localhost:5173/reset-password?token={reset_token}")

            return jsonify({'message': 'If the email exists, a reset link has been sent.'}), 200

        except Exception as e:
            print(f"Forgot password error: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/auth/reset-password', methods=['POST'])
    def reset_password():
        """Reset password using token."""
        try:
            data = request.get_json()
            if not data or not data.get('token') or not data.get('new_password'):
                return jsonify({'error': 'Token and new password are required'}), 400

            token = data['token']
            new_password = data['new_password']

            if len(new_password) < 6:
                return jsonify({'error': 'Password must be at least 6 characters long'}), 400

            db = get_db()
            cursor = db.cursor()

            # Find user with valid token
            cursor.execute('''
                SELECT id FROM users
                WHERE reset_token = ? AND reset_expires > ?
            ''', (token, datetime.datetime.utcnow().isoformat()))
            user = cursor.fetchone()

            if not user:
                return jsonify({'error': 'Invalid or expired token'}), 400

            # Update password and clear reset token
            new_password_hash = hash_password(new_password)
            cursor.execute('''
                UPDATE users
                SET password_hash = ?, reset_token = NULL, reset_expires = NULL
                WHERE id = ?
            ''', (new_password_hash, user['id']))
            db.commit()

            return jsonify({'message': 'Password reset successfully'}), 200

        except Exception as e:
            print(f"Reset password error: {e}")
            return jsonify({'error': 'Internal server error'}), 500
