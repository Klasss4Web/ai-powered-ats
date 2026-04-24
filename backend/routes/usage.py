"""
Usage tracking and limits for ATS Matcher Backend (PostgreSQL)
"""

import datetime
import json
from flask import jsonify, g, request
from db.database import get_db
from config import USAGE_LIMITS


def check_usage_limit(user_id, action_type='analysis'):
    """Check if user has exceeded their daily usage limit."""
    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        'SELECT subscription_type, subscription_expires_at FROM users WHERE id = %s',
        (user_id,)
    )
    user = cursor.fetchone()

    if not user:
        return False, "User not found"

    subscription_type = user['subscription_type']
    expires_at = user['subscription_expires_at']

    # ✅ Postgres timestamp is already datetime object
    if subscription_type == 'premium' and expires_at:
        if datetime.datetime.utcnow() > expires_at:
            subscription_type = 'free'

    today = datetime.date.today()

    # ✅ COUNT queries
    cursor.execute(
        '''
        SELECT COUNT(*) AS count
        FROM usage_tracking
        WHERE user_id = %s AND action_type = %s AND date_created = %s
        ''',
        (user_id, action_type, today)
    )
    current_usage = cursor.fetchone()['count']

    cursor.execute(
        '''
        SELECT COUNT(*) AS payment_count
        FROM usage_tracking
        WHERE user_id = %s AND action_type = %s AND date_created = %s
        ''',
        (user_id, 'payment', today)
    )
    payment_count = cursor.fetchone()['payment_count']

    limit = USAGE_LIMITS.get(subscription_type, 1)
    effective_limit = limit + payment_count

    if current_usage >= effective_limit:
        return False, f"Daily limit exceeded ({effective_limit})"

    return True, current_usage


def record_usage(user_id, action_type='analysis', metadata=None):
    """Record usage for tracking purposes."""
    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute(
            '''
            INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
            VALUES (%s, %s, %s, %s)
            ''',
            (
                user_id,
                action_type,
                datetime.date.today(),
                json.dumps(metadata) if metadata else None
            )
        )
        db.commit()
    except Exception as e:
        print("Usage insert error:", e)


def register_usage_routes(app):
    from auth.auth import token_required

    @app.route('/api/user/usage', methods=['GET'])
    @token_required
    def get_user_usage():
        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                'SELECT subscription_type, subscription_expires_at FROM users WHERE id = %s',
                (g.user_id,)
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({'error': 'User not found'}), 404

            subscription_type = user['subscription_type']
            expires_at = user['subscription_expires_at']

            is_expired = False
            if subscription_type == 'premium' and expires_at:
                if datetime.datetime.utcnow() > expires_at:
                    is_expired = True
                    subscription_type = 'free'

            today = datetime.date.today()

            cursor.execute(
                '''
                SELECT COUNT(*) AS count
                FROM usage_tracking
                WHERE user_id = %s AND action_type = %s AND date_created = %s
                ''',
                (g.user_id, 'analysis', today)
            )
            current_usage = cursor.fetchone()['count']

            cursor.execute(
                '''
                SELECT COUNT(*) AS payment_count
                FROM usage_tracking
                WHERE user_id = %s AND action_type = %s AND date_created = %s
                ''',
                (g.user_id, 'payment', today)
            )
            payment_count = cursor.fetchone()['payment_count']

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
            print("Usage check error:", e)
            return jsonify({'error': 'Internal server error'}), 500


    @app.route('/api/pay-as-you-go', methods=['POST'])
    @token_required
    def pay_as_you_go():
        try:
            data = request.get_json()
            amount = data.get('amount', 1.00)

            db = get_db()
            cursor = db.cursor()

            today = datetime.date.today()

            # ✅ JSONB query instead of LIKE
            cursor.execute(
                '''
                SELECT id FROM usage_tracking
                WHERE user_id = %s
                AND action_type = %s
                AND date_created = %s
                AND metadata->>'type' = 'pay_as_you_go'
                ''',
                (g.user_id, 'payment', today)
            )

            existing = cursor.fetchone()

            if not existing:
                cursor.execute(
                    '''
                    INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
                    VALUES (%s, %s, %s, %s)
                    ''',
                    (
                        g.user_id,
                        'payment',
                        today,
                        json.dumps({
                            'amount': amount,
                            'type': 'pay_as_you_go'
                        })
                    )
                )
                db.commit()

            return jsonify({
                'success': True,
                'message': 'Payment recorded',
                'amount': amount
            }), 200

        except Exception as e:
            print("Pay-as-you-go error:", e)
            return jsonify({'error': 'Payment failed'}), 500