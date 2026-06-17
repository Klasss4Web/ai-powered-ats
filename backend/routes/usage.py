"""
Usage tracking and limits for ATS Matcher Backend (PostgreSQL)
"""

import datetime
from logger.app_logger import logger
import json
from flask import jsonify, g, request
from db.database import get_db
from config import USAGE_LIMITS, PREMIUM_TIERS


# AI-powered features that share the daily limit.
# batch_analysis is included so recruiter analyses count against the same quota.
AI_FEATURES = ["analysis", "cover_letter", "interview_prep", "batch_analysis"]


def check_usage_limit(user_id, action_type="analysis"):
    """
    Check if user has exceeded their daily usage limit.
    All AI-powered features (analysis, cover_letter, interview_prep) share the same daily limit.
    """
    db = get_db()
    cursor = db.cursor()

    cursor.execute(
        "SELECT subscription_type, subscription_expires_at FROM users WHERE id = %s",
        (user_id,),
    )
    user = cursor.fetchone()

    if not user:
        return False, "User not found"

    subscription_type = user["subscription_type"]
    expires_at = user["subscription_expires_at"]

    # Check if paid subscription has expired — applies to both 'premium' and 'pro'
    if subscription_type in PREMIUM_TIERS and expires_at:
        if datetime.datetime.utcnow() > expires_at:
            subscription_type = "free"

    today = datetime.date.today()

    # Count ALL AI feature usage for today (shared limit)
    cursor.execute(
        """
        SELECT COUNT(*) AS count
        FROM usage_tracking
        WHERE user_id = %s AND action_type = ANY(%s) AND date_created = %s
        """,
        (user_id, AI_FEATURES, today),
    )
    current_usage = cursor.fetchone()["count"]

    # Count pay-as-you-go payments for today
    cursor.execute(
        """
        SELECT COUNT(*) AS payment_count
        FROM usage_tracking
        WHERE user_id = %s AND action_type = %s AND date_created = %s
        """,
        (user_id, "payment", today),
    )
    payment_count = cursor.fetchone()["payment_count"]

    limit = USAGE_LIMITS.get(subscription_type, 1)
    effective_limit = limit + payment_count

    if current_usage >= effective_limit:
        return (
            False,
            f"Daily limit of {effective_limit} AI features reached. Upgrade for more!",
        )

    return True, current_usage


def record_usage(user_id, action_type="analysis", metadata=None):
    """Record usage for tracking purposes."""
    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO usage_tracking (user_id, action_type, date_created, metadata)
            VALUES (%s, %s, %s, %s)
            """,
            (
                user_id,
                action_type,
                datetime.date.today(),
                json.dumps(metadata) if metadata else None,
            ),
        )
        db.commit()
    except Exception as e:
        logger.error(f"Usage insert error: {e}")


def register_usage_routes(app):
    from auth.auth import token_required

    @app.route("/api/user/usage", methods=["GET"])
    @token_required
    def get_user_usage():
        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                "SELECT subscription_type, subscription_expires_at FROM users WHERE id = %s",
                (g.user_id,),
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({"error": "User not found"}), 404

            subscription_type = user["subscription_type"]
            expires_at = user["subscription_expires_at"]

            is_expired = False
            if subscription_type in PREMIUM_TIERS and expires_at:
                if datetime.datetime.utcnow() > expires_at:
                    is_expired = True
                    subscription_type = "free"

            today = datetime.date.today()

            # Fix: count ALL AI features (analysis + cover_letter + interview_prep)
            # so the displayed usage matches what check_usage_limit actually enforces.
            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM usage_tracking
                WHERE user_id = %s AND action_type = ANY(%s) AND date_created = %s
                """,
                (g.user_id, AI_FEATURES, today),
            )
            current_usage = cursor.fetchone()["count"]

            cursor.execute(
                """
                SELECT COUNT(*) AS payment_count
                FROM usage_tracking
                WHERE user_id = %s AND action_type = %s AND date_created = %s
                """,
                (g.user_id, "payment", today),
            )
            payment_count = cursor.fetchone()["payment_count"]

            base_limit = USAGE_LIMITS.get(subscription_type, 1)
            effective_limit = base_limit + payment_count
            remaining = max(0, effective_limit - current_usage)

            return jsonify(
                {
                    "subscription_type": subscription_type,
                    "subscription_expires_at": expires_at,
                    "is_expired": is_expired,
                    "current_usage": current_usage,
                    "daily_limit": base_limit,
                    "pay_as_you_go_payments": payment_count,
                    "effective_limit": effective_limit,
                    "remaining_analyses": remaining,
                    "can_perform_analysis": remaining > 0,
                }
            ), 200

        except Exception as e:
            logger.error(f"Usage check error: {e}")
            return jsonify({"error": "Internal server error"}), 500

    @app.route("/api/user/usage/monthly", methods=["GET"])
    @token_required
    def get_user_monthly_usage():
        """Get current user's monthly token usage (all time, last 6 months)."""
        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                """
                SELECT
                    DATE_TRUNC('month', created_at) as month,
                    SUM(total_tokens) as total_tokens,
                    SUM(estimated_cost) as cost,
                    COUNT(*) as requests
                FROM token_usage
                WHERE user_id = %s
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY month DESC
                LIMIT 6
            """,
                (g.user_id,),
            )

            return jsonify({
                "monthly": [
                    {
                        "month": row["month"].strftime("%Y-%m"),
                        "total_tokens": row["total_tokens"] or 0,
                        "cost": round(row["cost"] or 0, 4),
                        "requests": row["requests"],
                    }
                    for row in cursor.fetchall()
                ]
            }), 200

        except Exception as e:
            logger.error(f"User monthly usage error: {e}")
            return jsonify({"error": "Failed to fetch usage"}), 500

    @app.route("/api/my-analysis", methods=["GET"])
    @token_required
    def get_my_analysis():
        """
        Premium-only endpoint: returns the authenticated user's past analyses,
        cover letters, and interview preps, paginated and sorted newest-first.
        """
        if g.user.get("subscription_type") not in PREMIUM_TIERS:
            return jsonify({
                "error": "My Analysis is a premium feature. Please upgrade your subscription.",
                "upgrade_required": True,
            }), 403

        try:
            db = get_db()
            cursor = db.cursor()

            page = request.args.get("page", 1, type=int)
            per_page = min(request.args.get("per_page", 10, type=int), 50)
            offset = (page - 1) * per_page

            # ---- Analyses ----
            cursor.execute(
                """
                SELECT id, job_description, result, overall_match_score, created_at
                FROM analyses
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (g.user_id, per_page, offset),
            )
            analyses_rows = cursor.fetchall()

            cursor.execute(
                "SELECT COUNT(*) AS total FROM analyses WHERE user_id = %s",
                (g.user_id,),
            )
            analyses_total = cursor.fetchone()["total"]

            # ---- Cover Letters ----
            cursor.execute(
                """
                SELECT id, company_name, job_title, cover_letter, word_count, created_at
                FROM cover_letters
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (g.user_id, per_page, offset),
            )
            cover_letter_rows = cursor.fetchall()

            cursor.execute(
                "SELECT COUNT(*) AS total FROM cover_letters WHERE user_id = %s",
                (g.user_id,),
            )
            cover_letters_total = cursor.fetchone()["total"]

            # ---- Interview Preps ----
            cursor.execute(
                """
                SELECT id, company_name, job_title, result, created_at
                FROM interview_preps
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
                """,
                (g.user_id, per_page, offset),
            )
            interview_prep_rows = cursor.fetchall()

            cursor.execute(
                "SELECT COUNT(*) AS total FROM interview_preps WHERE user_id = %s",
                (g.user_id,),
            )
            interview_preps_total = cursor.fetchone()["total"]

            def fmt_dt(val):
                return val.isoformat() if val else None

            return jsonify({
                "analyses": [
                    {
                        "id": r["id"],
                        "job_description": r["job_description"],
                        "result": r["result"],
                        "overall_match_score": r["overall_match_score"],
                        "created_at": fmt_dt(r["created_at"]),
                    }
                    for r in analyses_rows
                ],
                "cover_letters": [
                    {
                        "id": r["id"],
                        "company_name": r["company_name"],
                        "job_title": r["job_title"],
                        "cover_letter": r["cover_letter"],
                        "word_count": r["word_count"],
                        "created_at": fmt_dt(r["created_at"]),
                    }
                    for r in cover_letter_rows
                ],
                "interview_preps": [
                    {
                        "id": r["id"],
                        "company_name": r["company_name"],
                        "job_title": r["job_title"],
                        "result": r["result"],
                        "created_at": fmt_dt(r["created_at"]),
                    }
                    for r in interview_prep_rows
                ],
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "analyses_total": analyses_total,
                    "cover_letters_total": cover_letters_total,
                    "interview_preps_total": interview_preps_total,
                },
            }), 200

        except Exception as e:
            logger.error(f"My analysis fetch error for user {g.user_id}: {e}")
            return jsonify({"error": "Failed to fetch your analysis history"}), 500

    @app.route("/api/pay-as-you-go", methods=["POST"])
    @token_required
    def pay_as_you_go():
        """
        CRIT-6: This endpoint no longer grants usage credit directly.
        
        Pay-as-you-go credit is recorded ONLY after a payment has been verified
        by the payment gateway (Paystack or PayPal). The correct flow is:
          1. Frontend calls POST /api/payment/initialize  → gets a payment URL
          2. User completes payment on Paystack/PayPal
          3. Frontend calls GET /api/payment/verify/<reference> or
             GET /api/payment/verify-paypal/<order_id>
          4. The verify endpoint records the credit in usage_tracking.
        
        Calling this endpoint directly is not supported and will be rejected.
        """
        return jsonify({
            "error": (
                "Direct pay-as-you-go credit is not allowed. "
                "Please complete a payment via /api/payment/initialize and then "
                "verify it via /api/payment/verify/<reference>."
            )
        }), 403

    # ---------------------------
    # FRONTEND ERROR LOGGING
    # ---------------------------
    @app.route("/api/log-frontend-error", methods=["POST"])
    def log_frontend_error():
        """
        Accept error reports from the frontend so we can capture API failures,
        caught exceptions, and stack traces server-side with user attribution.
        """
        data = request.get_json() or {}
        try:
            user_id = getattr(g, "user_id", None)
            token_header = request.headers.get("Authorization", "")
            token = (
                token_header.split(" ")[1]
                if token_header.startswith("Bearer ")
                else None
            )
            payload = ""
            if token:
                import jwt
                from config import JWT_SECRET_KEY
                try:
                    payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
                    user_id = payload.get("user_id")
                except Exception:
                    pass

            logger.error(
                "FRONTEND ERROR | user_id=%s | endpoint=%s | message=%s | stack=%s",
                user_id,
                data.get("endpoint", "unknown"),
                data.get("message", "No message"),
                data.get("stack", "No stack trace"),
            )
            return jsonify({"success": True}), 200
        except Exception as e:
            logger.error(f"Failed to log frontend error: {e}")
            return jsonify({"error": "Internal server error"}), 500
