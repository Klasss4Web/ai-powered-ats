"""
Usage tracking and limits for ATS Matcher Backend
"""

import sqlite3
import datetime
from flask import jsonify, g
from database import get_db
from config import USAGE_LIMITS


def check_usage_limit(user_id, action_type='analysis'):
    """Check if user has exceeded their daily usage limit."""
    db = get_db()
    cursor = db.cursor()

    # Get user's subscription info
    cursor.execute('SELECT subscription_type, subscription_expires_at FROM users WHERE id = ?', (user_id,))
    user = cursor.fetchone()

    if not user:
        return False, "User not found"

    subscription_type = user['subscription_type']
    expires_at = user['subscription_expires_at']

    # Check if subscription is expired
    if subscription_type == 'premium' and expires_at:
        try:
            expires_dt = datetime.datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            if datetime.datetime.utcnow() > expires_dt:
                subscription_type = 'free'  # Treat as free if expired
        except:
            pass  # If date parsing fails, assume still valid

    # Get today's usage count for analyses
    today = datetime.date.today().isoformat()
    cursor.execute('''
        SELECT COUNT(*) as count FROM usage_tracking
        WHERE user_id = ? AND action_type = ? AND date_created = ?
    ''', (user_id, action_type, today))
    usage = cursor.fetchone()

    current_usage = usage['count'] if usage else 0

    # Check for pay-as-you-go payments today
    cursor.execute('''
        SELECT COUNT(*) as payment_count FROM usage_tracking
        WHERE user_id = ? AND action_type = ? AND date_created = ?
    ''', (user_id, 'payment', today))
    payments = cursor.fetchone()
    payment_count = payments['payment_count'] if payments else 0

    # Define limits
    limit = USAGE_LIMITS.get(subscription_type, 1)

    # Allow additional analyses for each pay-as-you-go payment
    effective_limit = limit + payment_count

    if current_usage >= effective_limit:
        if subscription_type == 'free':
            return False, f"Daily {action_type} limit exceeded. Pay-as-you-go allows {payment_count} {action_type}(s) per day."
        else:
            return False, f"Daily {action_type} limit exceeded. {subscription_type.capitalize()} users can perform {limit} {action_type}(s) per day, plus {payment_count} pay-as-you-go."

    return True, current_usage


def record_usage(user_id, action_type='analysis', metadata=None):
    """Record usage for tracking purposes."""
    db = get_db()
    cursor = db.cursor()

    today = datetime.date.today().isoformat()
    try:
        cursor.execute('''
            INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
            VALUES (?, ?, ?, ?)
        ''', (user_id, action_type, today, metadata))
        db.commit()
    except sqlite3.IntegrityError:
        # If unique constraint fails, usage already recorded for today
        pass


def register_usage_routes(app):
    """Register usage-related routes."""
    from auth import token_required

    @app.route('/api/user/usage', methods=['GET'])
    @token_required
    def get_user_usage():
        """Get user's current usage status and limits."""
        try:
            db = get_db()
            cursor = db.cursor()

            # Get user's subscription info
            cursor.execute('SELECT subscription_type, subscription_expires_at FROM users WHERE id = ?', (g.user_id,))
            user = cursor.fetchone()

            if not user:
                return jsonify({'error': 'User not found'}), 404

            subscription_type = user['subscription_type']
            expires_at = user['subscription_expires_at']

            # Check if subscription is expired
            is_expired = False
            if subscription_type == 'premium' and expires_at:
                try:
                    expires_dt = datetime.datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                    if datetime.datetime.utcnow() > expires_dt:
                        is_expired = True
                        subscription_type = 'free'  # Treat as free if expired
                except:
                    pass

            # Get today's usage count
            today = datetime.date.today().isoformat()
            cursor.execute('''
                SELECT COUNT(*) as count FROM usage_tracking
                WHERE user_id = ? AND action_type = ? AND date_created = ?
            ''', (g.user_id, 'analysis', today))
            usage = cursor.fetchone()

            current_usage = usage['count'] if usage else 0

            # Check for pay-as-you-go payments today
            cursor.execute('''
                SELECT COUNT(*) as payment_count FROM usage_tracking
                WHERE user_id = ? AND action_type = ? AND date_created = ?
            ''', (g.user_id, 'payment', today))
            payments = cursor.fetchone()
            payment_count = payments['payment_count'] if payments else 0

            # Define limits
            base_limit = USAGE_LIMITS.get(subscription_type, 1)
            effective_limit = base_limit + payment_count
            remaining = max(0, effective_limit - current_usage)

            return jsonify({
                'subscription_type': subscription_type,
                'subscription_expires_at': expires_at,
                'is_expired': is_expired,
                'current_usage': current_usage,
                'daily_limit': base_limit,
                'pay_as_you_go_payments': payment_count,
                'effective_limit': effective_limit,
                'remaining_analyses': remaining,
                'can_perform_analysis': remaining > 0
            }), 200

        except Exception as e:
            print(f"Usage check error: {e}")
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/api/pay-as-you-go', methods=['POST'])
    @token_required
    def pay_as_you_go():
        """Process pay-as-you-go payment for one analysis."""
        try:
            import json
            data = request.get_json()
            amount = data.get('amount', 1.00)

            # In a real implementation, this would integrate with a payment processor like Stripe
            # For now, we'll simulate a successful payment

            # Log the payment (in production, this would be handled by payment processor)
            db = get_db()
            cursor = db.cursor()

            # Check if payment already recorded (prevent duplicates)
            cursor.execute('''
                SELECT id FROM usage_tracking 
                WHERE user_id = ? AND action_type = ? AND metadata LIKE ? AND date_created = ?
            ''', (g.user_id, 'payment', f'%"type":"pay_as_you_go"%', datetime.date.today().isoformat()))
            existing = cursor.fetchone()
            
            if not existing:
                cursor.execute('''
                    INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
                    VALUES (?, ?, ?, ?)
                ''', (g.user_id, 'payment', datetime.date.today().isoformat(), json.dumps({
                    'amount': amount,
                    'type': 'pay_as_you_go'
                })))

                db.commit()
            else:
                print("Pay-as-you-go payment already recorded today, skipping duplicate")

            return jsonify({
                'success': True,
                'message': 'Payment processed successfully',
                'amount': amount
            }), 200

        except Exception as e:
            print(f"Pay-as-you-go error: {e}")
            return jsonify({'error': 'Payment processing failed'}), 500
