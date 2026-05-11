"""
Admin routes for ATS Matcher Backend - Observability & Analytics
"""

import json
from datetime import datetime, timedelta
from flask import jsonify, request, g
from db.database import get_db
from auth.auth import admin_required
from logger.app_logger import logger


# Helper function to format endpoint names for display
def format_endpoint_name(endpoint):
    """Convert API endpoint to human-readable name."""
    endpoint_names = {
        "/api/match": "Resume Analysis",
        "/api/generate-cv": "Generate CV",
        "/api/generate-optimized-resume": "Optimized Resume",
        "/api/generate-cover-letter": "Cover Letter",
        "/api/batch-match": "Batch Analysis",
        "/api/recruiter/report": "Recruiter Report",
        "/api/interview-prep": "Interview Prep",
        "/api/recruiter/sessions/analyze": "Session Analysis",
    }
    return endpoint_names.get(endpoint, endpoint)


def register_admin_routes(app):
    """Register all admin API routes."""

    # ---------------------------
    # DASHBOARD OVERVIEW
    # ---------------------------
    @app.route("/api/admin/dashboard", methods=["GET"])
    @admin_required
    def admin_dashboard():
        """Get overview statistics for admin dashboard."""
        try:
            db = get_db()
            cursor = db.cursor()

            # Total users
            cursor.execute("SELECT COUNT(*) as count FROM users")
            total_users = cursor.fetchone()["count"]

            # Users by subscription type
            cursor.execute("""
                SELECT subscription_type, COUNT(*) as count 
                FROM users 
                GROUP BY subscription_type
            """)
            users_by_subscription = {
                row["subscription_type"]: row["count"] for row in cursor.fetchall()
            }

            # New users today
            cursor.execute("""
                SELECT COUNT(*) as count FROM users 
                WHERE DATE(created_at) = CURRENT_DATE
            """)
            new_users_today = cursor.fetchone()["count"]

            # New users this week
            cursor.execute("""
                SELECT COUNT(*) as count FROM users 
                WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
            """)
            new_users_week = cursor.fetchone()["count"]

            # Total analyses today
            cursor.execute("""
                SELECT COUNT(*) as count FROM usage_tracking 
                WHERE action_type = 'analysis' AND DATE(created_at) = CURRENT_DATE
            """)
            analyses_today = cursor.fetchone()["count"]

            # Total analyses this week
            cursor.execute("""
                SELECT COUNT(*) as count FROM usage_tracking 
                WHERE action_type = 'analysis' AND created_at >= CURRENT_DATE - INTERVAL '7 days'
            """)
            analyses_week = cursor.fetchone()["count"]

            # Total analyses all time
            cursor.execute("""
                SELECT COUNT(*) as count FROM usage_tracking 
                WHERE action_type = 'analysis'
            """)
            analyses_total = cursor.fetchone()["count"]

            # API metrics summary (if available)
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_requests,
                    AVG(response_time_ms) as avg_response_time,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
                FROM api_metrics 
                WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
            """)
            api_summary = cursor.fetchone()

            # Token usage today
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(total_tokens), 0) as total_tokens,
                    COALESCE(SUM(estimated_cost), 0) as total_cost
                FROM token_usage 
                WHERE DATE(created_at) = CURRENT_DATE
            """)
            token_summary = cursor.fetchone()

            return jsonify(
                {
                    "users": {
                        "total": total_users,
                        "by_subscription": users_by_subscription,
                        "new_today": new_users_today,
                        "new_this_week": new_users_week,
                    },
                    "analyses": {
                        "today": analyses_today,
                        "this_week": analyses_week,
                        "total": analyses_total,
                    },
                    "api": {
                        "requests_24h": api_summary["total_requests"]
                        if api_summary
                        else 0,
                        "avg_response_time_ms": round(
                            api_summary["avg_response_time"] or 0, 2
                        )
                        if api_summary
                        else 0,
                        "errors_24h": api_summary["error_count"] if api_summary else 0,
                    },
                    "tokens": {
                        "used_today": token_summary["total_tokens"]
                        if token_summary
                        else 0,
                        "cost_today": round(token_summary["total_cost"] or 0, 4)
                        if token_summary
                        else 0,
                    },
                }
            )

        except Exception as e:
            logger.error(f"Admin dashboard error: {e}")
            return jsonify({"error": "Failed to fetch dashboard data"}), 500

    # ---------------------------
    # TRAFFIC ANALYTICS
    # ---------------------------
    @app.route("/api/admin/analytics/traffic", methods=["GET"])
    @admin_required
    def admin_traffic_analytics():
        """Get traffic analytics data."""
        try:
            db = get_db()
            cursor = db.cursor()

            # Get time range from query params (default: 7 days)
            days = request.args.get("days", 7, type=int)
            if days > 90:
                days = 90  # Limit to 90 days

            # Daily active users
            cursor.execute(
                """
                SELECT 
                    DATE(created_at) as date,
                    COUNT(DISTINCT user_id) as active_users
                FROM usage_tracking
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """,
                (days,),
            )
            daily_active_users = [
                {"date": str(row["date"]), "count": row["active_users"]}
                for row in cursor.fetchall()
            ]

            # Daily analyses
            cursor.execute(
                """
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM usage_tracking
                WHERE action_type = 'analysis' 
                    AND created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """,
                (days,),
            )
            daily_analyses = [
                {"date": str(row["date"]), "count": row["count"]}
                for row in cursor.fetchall()
            ]

            # Daily new registrations
            cursor.execute(
                """
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as count
                FROM users
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """,
                (days,),
            )
            daily_registrations = [
                {"date": str(row["date"]), "count": row["count"]}
                for row in cursor.fetchall()
            ]

            # Hourly traffic pattern (last 24 hours)
            cursor.execute("""
                SELECT 
                    EXTRACT(HOUR FROM created_at) as hour,
                    COUNT(*) as count
                FROM usage_tracking
                WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY hour
            """)
            hourly_traffic = [
                {"hour": int(row["hour"]), "count": row["count"]}
                for row in cursor.fetchall()
            ]

            # Top endpoints (from api_metrics)
            cursor.execute(
                """
                SELECT 
                    endpoint,
                    COUNT(*) as count,
                    AVG(response_time_ms) as avg_time
                FROM api_metrics
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY endpoint
                ORDER BY count DESC
                LIMIT 10
            """,
                (days,),
            )
            top_endpoints = [
                {
                    "endpoint": row["endpoint"],
                    "count": row["count"],
                    "avg_time": round(row["avg_time"] or 0, 2),
                }
                for row in cursor.fetchall()
            ]

            return jsonify(
                {
                    "daily_active_users": daily_active_users,
                    "daily_analyses": daily_analyses,
                    "daily_registrations": daily_registrations,
                    "hourly_traffic": hourly_traffic,
                    "top_endpoints": top_endpoints,
                    "period_days": days,
                }
            )

        except Exception as e:
            logger.error(f"Traffic analytics error: {e}")
            return jsonify({"error": "Failed to fetch traffic data"}), 500

    # ---------------------------
    # TOKEN USAGE ANALYTICS
    # ---------------------------
    @app.route("/api/admin/analytics/tokens", methods=["GET"])
    @admin_required
    def admin_token_analytics():
        """Get token usage analytics."""
        try:
            db = get_db()
            cursor = db.cursor()

            days = request.args.get("days", 7, type=int)
            if days > 90:
                days = 90

            # Daily token usage
            cursor.execute(
                """
                SELECT 
                    DATE(created_at) as date,
                    SUM(prompt_tokens) as prompt_tokens,
                    SUM(completion_tokens) as completion_tokens,
                    SUM(total_tokens) as total_tokens,
                    SUM(estimated_cost) as cost
                FROM token_usage
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """,
                (days,),
            )
            daily_usage = [
                {
                    "date": str(row["date"]),
                    "prompt_tokens": row["prompt_tokens"] or 0,
                    "completion_tokens": row["completion_tokens"] or 0,
                    "total_tokens": row["total_tokens"] or 0,
                    "cost": round(row["cost"] or 0, 4),
                }
                for row in cursor.fetchall()
            ]

            # Usage by endpoint
            cursor.execute(
                """
                SELECT 
                    endpoint,
                    SUM(total_tokens) as total_tokens,
                    SUM(estimated_cost) as cost,
                    COUNT(*) as request_count
                FROM token_usage
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY endpoint
                ORDER BY total_tokens DESC
            """,
                (days,),
            )
            by_endpoint = [
                {
                    "endpoint": row["endpoint"],
                    "total_tokens": row["total_tokens"] or 0,
                    "cost": round(row["cost"] or 0, 4),
                    "requests": row["request_count"],
                }
                for row in cursor.fetchall()
            ]

            # Total summary
            cursor.execute(
                """
                SELECT 
                    SUM(prompt_tokens) as prompt_tokens,
                    SUM(completion_tokens) as completion_tokens,
                    SUM(total_tokens) as total_tokens,
                    SUM(estimated_cost) as total_cost,
                    COUNT(*) as total_requests
                FROM token_usage
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
            """,
                (days,),
            )
            summary = cursor.fetchone()

            # Top users by token usage
            cursor.execute(
                """
                SELECT 
                    u.id as user_id,
                    u.email,
                    u.name,
                    SUM(t.total_tokens) as total_tokens,
                    SUM(t.estimated_cost) as cost,
                    COUNT(*) as request_count
                FROM token_usage t
                JOIN users u ON t.user_id = u.id
                WHERE t.created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY u.id, u.email, u.name
                ORDER BY total_tokens DESC
                LIMIT 10
            """,
                (days,),
            )
            top_users_raw = cursor.fetchall()

            # Get endpoint breakdown for each top user
            top_users = []
            for row in top_users_raw:
                # Get breakdown by endpoint for this user
                cursor.execute(
                    """
                    SELECT 
                        endpoint,
                        COUNT(*) as count,
                        SUM(total_tokens) as tokens
                    FROM token_usage
                    WHERE user_id = %s AND created_at >= CURRENT_DATE - INTERVAL '%s days'
                    GROUP BY endpoint
                    ORDER BY tokens DESC
                    """,
                    (row["user_id"], days),
                )
                endpoint_breakdown = [
                    {
                        "endpoint": format_endpoint_name(r["endpoint"]),
                        "count": r["count"],
                        "tokens": r["tokens"] or 0,
                    }
                    for r in cursor.fetchall()
                ]

                top_users.append(
                    {
                        "email": row["email"],
                        "name": row["name"],
                        "total_tokens": row["total_tokens"] or 0,
                        "cost": round(row["cost"] or 0, 4),
                        "request_count": row["request_count"],
                        "breakdown": endpoint_breakdown,
                    }
                )

            return jsonify(
                {
                    "daily_usage": daily_usage,
                    "by_endpoint": by_endpoint,
                    "summary": {
                        "prompt_tokens": summary["prompt_tokens"] or 0
                        if summary
                        else 0,
                        "completion_tokens": summary["completion_tokens"] or 0
                        if summary
                        else 0,
                        "total_tokens": summary["total_tokens"] or 0 if summary else 0,
                        "total_cost": round(summary["total_cost"] or 0, 4)
                        if summary
                        else 0,
                        "total_requests": summary["total_requests"] or 0
                        if summary
                        else 0,
                    },
                    "top_users": top_users,
                    "period_days": days,
                }
            )

        except Exception as e:
            logger.error(f"Token analytics error: {e}")
            return jsonify({"error": "Failed to fetch token data"}), 500

    # ---------------------------
    # USERS MANAGEMENT
    # ---------------------------
    @app.route("/api/admin/users", methods=["GET"])
    @admin_required
    def admin_list_users():
        """Get paginated list of users."""
        try:
            db = get_db()
            cursor = db.cursor()

            page = request.args.get("page", 1, type=int)
            per_page = request.args.get("per_page", 20, type=int)
            search = request.args.get("search", "")
            subscription_filter = request.args.get("subscription", "")

            if per_page > 100:
                per_page = 100

            offset = (page - 1) * per_page

            # Build query with filters
            where_clauses = []
            params = []

            if search:
                where_clauses.append("(email ILIKE %s OR name ILIKE %s)")
                params.extend([f"%{search}%", f"%{search}%"])

            if subscription_filter:
                where_clauses.append("subscription_type = %s")
                params.append(subscription_filter)

            where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

            # Get total count
            cursor.execute(
                f"SELECT COUNT(*) as count FROM users WHERE {where_sql}", params
            )
            total = cursor.fetchone()["count"]

            # Get users
            cursor.execute(
                f"""
                SELECT 
                    id, email, name, role, subscription_type, 
                    subscription_expires_at, created_at
                FROM users 
                WHERE {where_sql}
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            """,
                params + [per_page, offset],
            )

            users = []
            for row in cursor.fetchall():
                # Get usage count for each user
                cursor.execute(
                    """
                    SELECT COUNT(*) as count FROM usage_tracking 
                    WHERE user_id = %s
                """,
                    (row["id"],),
                )
                usage_count = cursor.fetchone()["count"]

                users.append(
                    {
                        "id": row["id"],
                        "email": row["email"],
                        "name": row["name"],
                        "role": row["role"] or "user",
                        "subscription_type": row["subscription_type"],
                        "subscription_expires_at": row[
                            "subscription_expires_at"
                        ].isoformat()
                        if row["subscription_expires_at"]
                        else None,
                        "created_at": row["created_at"].isoformat()
                        if row["created_at"]
                        else None,
                        "usage_count": usage_count,
                    }
                )

            return jsonify(
                {
                    "users": users,
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": total,
                        "pages": (total + per_page - 1) // per_page,
                    },
                }
            )

        except Exception as e:
            logger.error(f"List users error: {e}")
            return jsonify({"error": "Failed to fetch users"}), 500

    # ---------------------------
    # UPDATE USER ROLE
    # ---------------------------
    @app.route("/api/admin/users/<int:user_id>/role", methods=["PUT"])
    @admin_required
    def admin_update_user_role(user_id):
        """Update a user's role."""
        try:
            data = request.json
            if not data or "role" not in data:
                return jsonify({"error": "Role is required"}), 400

            new_role = data["role"]
            if new_role not in ["user", "admin"]:
                return jsonify({"error": "Invalid role"}), 400

            # Prevent self-demotion
            if user_id == g.user_id and new_role != "admin":
                return jsonify({"error": "Cannot remove your own admin role"}), 400

            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                """
                UPDATE users SET role = %s WHERE id = %s RETURNING id
            """,
                (new_role, user_id),
            )

            if not cursor.fetchone():
                return jsonify({"error": "User not found"}), 404

            db.commit()

            return jsonify({"message": "User role updated successfully"})

        except Exception as e:
            logger.error(f"Update user role error: {e}")
            return jsonify({"error": "Failed to update user role"}), 500

    # ---------------------------
    # API PERFORMANCE METRICS
    # ---------------------------
    @app.route("/api/admin/analytics/performance", methods=["GET"])
    @admin_required
    def admin_performance_analytics():
        """Get API performance metrics."""
        try:
            db = get_db()
            cursor = db.cursor()

            days = request.args.get("days", 7, type=int)
            if days > 90:
                days = 90

            # Response time trends
            cursor.execute(
                """
                SELECT 
                    DATE(created_at) as date,
                    AVG(response_time_ms) as avg_time,
                    MIN(response_time_ms) as min_time,
                    MAX(response_time_ms) as max_time,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95
                FROM api_metrics
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """,
                (days,),
            )
            response_times = [
                {
                    "date": str(row["date"]),
                    "avg": round(row["avg_time"] or 0, 2),
                    "min": round(row["min_time"] or 0, 2),
                    "max": round(row["max_time"] or 0, 2),
                    "p95": round(row["p95"] or 0, 2),
                }
                for row in cursor.fetchall()
            ]

            # Error rates
            cursor.execute(
                """
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as total,
                    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as errors,
                    COUNT(CASE WHEN status_code >= 500 THEN 1 END) as server_errors
                FROM api_metrics
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY DATE(created_at)
                ORDER BY date
            """,
                (days,),
            )
            error_rates = [
                {
                    "date": str(row["date"]),
                    "total": row["total"],
                    "errors": row["errors"],
                    "server_errors": row["server_errors"],
                    "error_rate": round((row["errors"] / row["total"]) * 100, 2)
                    if row["total"] > 0
                    else 0,
                }
                for row in cursor.fetchall()
            ]

            # Slowest endpoints
            cursor.execute(
                """
                SELECT 
                    endpoint,
                    AVG(response_time_ms) as avg_time,
                    COUNT(*) as count
                FROM api_metrics
                WHERE created_at >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY endpoint
                HAVING COUNT(*) >= 5
                ORDER BY avg_time DESC
                LIMIT 10
            """,
                (days,),
            )
            slowest_endpoints = [
                {
                    "endpoint": row["endpoint"],
                    "avg_time": round(row["avg_time"] or 0, 2),
                    "count": row["count"],
                }
                for row in cursor.fetchall()
            ]

            return jsonify(
                {
                    "response_times": response_times,
                    "error_rates": error_rates,
                    "slowest_endpoints": slowest_endpoints,
                    "period_days": days,
                }
            )

        except Exception as e:
            logger.error(f"Performance analytics error: {e}")
            return jsonify({"error": "Failed to fetch performance data"}), 500

    # ---------------------------
    # RECENT ACTIVITY LOG
    # ---------------------------
    @app.route("/api/admin/activity", methods=["GET"])
    @admin_required
    def admin_activity_log():
        """Get recent activity log."""
        try:
            db = get_db()
            cursor = db.cursor()

            limit = request.args.get("limit", 50, type=int)
            if limit > 200:
                limit = 200

            cursor.execute(
                """
                SELECT 
                    ut.id,
                    ut.action_type,
                    ut.created_at,
                    ut.metadata,
                    u.email,
                    u.name
                FROM usage_tracking ut
                JOIN users u ON ut.user_id = u.id
                ORDER BY ut.created_at DESC
                LIMIT %s
            """,
                (limit,),
            )

            activities = [
                {
                    "id": row["id"],
                    "action_type": row["action_type"],
                    "created_at": row["created_at"].isoformat()
                    if row["created_at"]
                    else None,
                    "metadata": row["metadata"],
                    "user_email": row["email"],
                    "user_name": row["name"],
                }
                for row in cursor.fetchall()
            ]

            return jsonify({"activities": activities})

        except Exception as e:
            logger.error(f"Activity log error: {e}")
            return jsonify({"error": "Failed to fetch activity log"}), 500
