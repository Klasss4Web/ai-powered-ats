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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                    AND created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                WHERE t.created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
                GROUP BY u.id, u.email, u.name
                ORDER BY total_tokens DESC
                LIMIT 10
            """,
                (days,),
            )
            top_users_raw = cursor.fetchall()

            # HIGH-6: Replace N+1 per-user endpoint-breakdown queries with a single
            # aggregated query that fetches all breakdowns at once.
            if top_users_raw:
                top_user_ids = [r["user_id"] for r in top_users_raw]
                cursor.execute(
                    """
                    SELECT
                        user_id,
                        endpoint,
                        COUNT(*) AS count,
                        SUM(total_tokens) AS tokens
                    FROM token_usage
                    WHERE user_id = ANY(%s)
                      AND created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
                    GROUP BY user_id, endpoint
                    ORDER BY tokens DESC
                    """,
                    (top_user_ids, days),
                )
                breakdown_rows = cursor.fetchall()
                # Build a dict keyed by user_id for O(1) lookup
                breakdown_by_user = {}
                for br in breakdown_rows:
                    uid = br["user_id"]
                    breakdown_by_user.setdefault(uid, []).append({
                        "endpoint": format_endpoint_name(br["endpoint"]),
                        "count": br["count"],
                        "tokens": br["tokens"] or 0,
                    })
            else:
                breakdown_by_user = {}

            top_users = [
                {
                    "email": row["email"],
                    "name": row["name"],
                    "total_tokens": row["total_tokens"] or 0,
                    "cost": round(row["cost"] or 0, 4),
                    "request_count": row["request_count"],
                    "breakdown": breakdown_by_user.get(row["user_id"], []),
                }
                for row in top_users_raw
            ]

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

            # HIGH-5: Replace N+1 per-user usage count queries with a single LEFT JOIN aggregation.
            cursor.execute(
                f"""
                SELECT 
                    u.id, u.email, u.name, u.role, u.subscription_type, 
                    u.subscription_expires_at, u.created_at,
                    COUNT(ut.id) AS usage_count
                FROM users u
                LEFT JOIN usage_tracking ut ON ut.user_id = u.id
                WHERE {where_sql}
                GROUP BY u.id, u.email, u.name, u.role, u.subscription_type,
                         u.subscription_expires_at, u.created_at
                ORDER BY u.created_at DESC
                LIMIT %s OFFSET %s
            """,
                params + [per_page, offset],
            )

            users = [
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
                    "usage_count": row["usage_count"],
                }
                for row in cursor.fetchall()
            ]

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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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
                WHERE created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')
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

    # ---------------------------
    # ERROR LOG
    # ---------------------------
    @app.route("/api/admin/errors", methods=["GET"])
    @admin_required
    def admin_error_log():
        """
        Full error log from api_metrics.
        Returns:
          - summary: total errors, 4xx count, 5xx count, error rate, affected users
          - by_endpoint: which endpoints generate the most errors
          - by_status_code: distribution of error status codes
          - top_affected_users: users who hit the most errors
          - errors: paginated per-request error rows
        Query params:
          ?days=7        — time window (max 90)
          ?page=1
          ?per_page=50   — rows per page (max 200)
          ?status_class  — "4xx" | "5xx" | "" (all errors)
          ?endpoint      — filter to a specific endpoint path
        """
        try:
            db = get_db()
            cursor = db.cursor()

            days = min(request.args.get("days", 7, type=int), 90)
            page = request.args.get("page", 1, type=int)
            per_page = min(request.args.get("per_page", 50, type=int), 200)
            status_class = request.args.get("status_class", "")   # "4xx" | "5xx" | ""
            endpoint_filter = request.args.get("endpoint", "").strip()
            offset = (page - 1) * per_page

            # Build dynamic WHERE clause.
            # where_sql      — for single-table queries (FROM api_metrics, no alias)
            # am_where_sql   — for JOIN queries where api_metrics is aliased as `am`
            where_parts = [
                "status_code >= 400",
                "created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')",
            ]
            am_where_parts = [
                "am.status_code >= 400",
                "am.created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')",
            ]
            params = [days]

            if status_class == "4xx":
                where_parts.append("status_code < 500")
                am_where_parts.append("am.status_code < 500")
            elif status_class == "5xx":
                where_parts.append("status_code >= 500")
                am_where_parts.append("am.status_code >= 500")

            if endpoint_filter:
                where_parts.append("endpoint ILIKE %s")
                am_where_parts.append("am.endpoint ILIKE %s")
                params.append(f"%{endpoint_filter}%")

            where_sql    = " AND ".join(where_parts)
            am_where_sql = " AND ".join(am_where_parts)

            # ── Summary stats ──────────────────────────────────
            cursor.execute(
                f"""
                SELECT
                    COUNT(*)                                                   AS total_errors,
                    COUNT(CASE WHEN status_code < 500 THEN 1 END)             AS client_errors,
                    COUNT(CASE WHEN status_code >= 500 THEN 1 END)            AS server_errors,
                    COUNT(DISTINCT user_id)                                    AS affected_users,
                    COUNT(DISTINCT CASE WHEN status_code >= 500
                                        THEN user_id END)                     AS server_error_users,
                    AVG(response_time_ms)                                     AS avg_response_ms,
                    MAX(response_time_ms)                                     AS max_response_ms,
                    MIN(created_at)                                           AS oldest_error,
                    MAX(created_at)                                           AS newest_error
                FROM api_metrics
                WHERE {where_sql}
                """,
                params,
            )
            summary_row = cursor.fetchone()

            # Total requests in same window for error rate
            rate_params = [days]
            rate_where = "created_at >= CURRENT_DATE - (%s * INTERVAL '1 day')"
            if endpoint_filter:
                rate_where += " AND endpoint ILIKE %s"
                rate_params.append(f"%{endpoint_filter}%")
            cursor.execute(
                f"SELECT COUNT(*) AS total FROM api_metrics WHERE {rate_where}",
                rate_params,
            )
            total_requests = cursor.fetchone()["total"] or 1  # avoid divide-by-zero

            # ── Errors by endpoint ─────────────────────────────
            cursor.execute(
                f"""
                SELECT
                    endpoint,
                    COUNT(*)                                        AS error_count,
                    COUNT(CASE WHEN status_code >= 500 THEN 1 END) AS server_errors,
                    COUNT(CASE WHEN status_code < 500 THEN 1 END)  AS client_errors,
                    AVG(response_time_ms)                          AS avg_response_ms,
                    MAX(status_code)                               AS worst_status
                FROM api_metrics
                WHERE {where_sql}
                GROUP BY endpoint
                ORDER BY error_count DESC
                LIMIT 15
                """,
                params,
            )
            by_endpoint = [
                {
                    "endpoint": r["endpoint"],
                    "error_count": r["error_count"],
                    "server_errors": r["server_errors"],
                    "client_errors": r["client_errors"],
                    "avg_response_ms": round(r["avg_response_ms"] or 0, 1),
                    "worst_status": r["worst_status"],
                }
                for r in cursor.fetchall()
            ]

            # ── Errors by status code ──────────────────────────
            cursor.execute(
                f"""
                SELECT
                    status_code,
                    COUNT(*) AS count,
                    endpoint AS most_common_endpoint
                FROM api_metrics
                WHERE {where_sql}
                GROUP BY status_code, endpoint
                ORDER BY count DESC
                """,
                params,
            )
            # Collapse: one row per status_code, picking the most-common endpoint
            status_map = {}
            for r in cursor.fetchall():
                sc = r["status_code"]
                if sc not in status_map:
                    status_map[sc] = {
                        "status_code": sc,
                        "count": r["count"],
                        "most_common_endpoint": r["most_common_endpoint"],
                    }
                else:
                    status_map[sc]["count"] += r["count"]
            by_status_code = sorted(
                status_map.values(), key=lambda x: x["count"], reverse=True
            )

            # ── Top affected users ────────────────────────────
            cursor.execute(
                f"""
                SELECT
                    am.user_id,
                    u.email,
                    u.name,
                    COUNT(*)                                          AS error_count,
                    COUNT(CASE WHEN am.status_code >= 500 THEN 1 END) AS server_errors,
                    MAX(am.created_at)                               AS last_error_at
                FROM api_metrics am
                LEFT JOIN users u ON am.user_id = u.id
                WHERE {am_where_sql}
                  AND am.user_id IS NOT NULL
                GROUP BY am.user_id, u.email, u.name
                ORDER BY error_count DESC
                LIMIT 10
                """,
                params,
            )
            top_affected_users = [
                {
                    "user_id": r["user_id"],
                    "email": r["email"] or "Unknown",
                    "name": r["name"] or "Unknown",
                    "error_count": r["error_count"],
                    "server_errors": r["server_errors"],
                    "last_error_at": r["last_error_at"].isoformat()
                    if r["last_error_at"]
                    else None,
                }
                for r in cursor.fetchall()
            ]

            # ── Daily error trend ─────────────────────────────
            cursor.execute(
                f"""
                SELECT
                    DATE(created_at)                                       AS date,
                    COUNT(*)                                               AS total_errors,
                    COUNT(CASE WHEN status_code >= 500 THEN 1 END)        AS server_errors,
                    COUNT(CASE WHEN status_code < 500 THEN 1 END)         AS client_errors
                FROM api_metrics
                WHERE {where_sql}
                GROUP BY DATE(created_at)
                ORDER BY date
                """,
                params,
            )
            daily_trend = [
                {
                    "date": str(r["date"]),
                    "total_errors": r["total_errors"],
                    "server_errors": r["server_errors"],
                    "client_errors": r["client_errors"],
                }
                for r in cursor.fetchall()
            ]

            # ── Paginated per-request error rows ──────────────
            cursor.execute(
                f"""
                SELECT
                    am.id,
                    am.endpoint,
                    am.method,
                    am.status_code,
                    am.response_time_ms,
                    am.ip_address,
                    am.user_agent,
                    am.created_at,
                    am.user_id,
                    u.email   AS user_email,
                    u.name    AS user_name
                FROM api_metrics am
                LEFT JOIN users u ON am.user_id = u.id
                WHERE {am_where_sql}
                ORDER BY am.created_at DESC
                LIMIT %s OFFSET %s
                """,
                params + [per_page, offset],
            )
            error_rows = cursor.fetchall()

            # Total count for pagination
            cursor.execute(
                f"SELECT COUNT(*) AS total FROM api_metrics WHERE {where_sql}",
                params,
            )
            total_errors = cursor.fetchone()["total"]

            def fmt(dt):
                return dt.isoformat() if dt else None

            errors = [
                {
                    "id": r["id"],
                    "endpoint": r["endpoint"],
                    "method": r["method"],
                    "status_code": r["status_code"],
                    "response_time_ms": round(r["response_time_ms"] or 0, 1),
                    "ip_address": r["ip_address"],
                    "user_agent": (r["user_agent"] or "")[:120],
                    "created_at": fmt(r["created_at"]),
                    "user_id": r["user_id"],
                    "user_email": r["user_email"],
                    "user_name": r["user_name"],
                }
                for r in error_rows
            ]

            return jsonify(
                {
                    "summary": {
                        "total_errors": summary_row["total_errors"] or 0,
                        "client_errors": summary_row["client_errors"] or 0,
                        "server_errors": summary_row["server_errors"] or 0,
                        "affected_users": summary_row["affected_users"] or 0,
                        "error_rate": round(
                            ((summary_row["total_errors"] or 0) / total_requests) * 100, 2
                        ),
                        "avg_response_ms": round(
                            summary_row["avg_response_ms"] or 0, 1
                        ),
                        "max_response_ms": round(
                            summary_row["max_response_ms"] or 0, 1
                        ),
                        "oldest_error": fmt(summary_row["oldest_error"]),
                        "newest_error": fmt(summary_row["newest_error"]),
                    },
                    "by_endpoint": by_endpoint,
                    "by_status_code": by_status_code,
                    "top_affected_users": top_affected_users,
                    "daily_trend": daily_trend,
                    "errors": errors,
                    "pagination": {
                        "page": page,
                        "per_page": per_page,
                        "total": total_errors,
                        "pages": max(1, (total_errors + per_page - 1) // per_page),
                    },
                    "filters": {
                        "days": days,
                        "status_class": status_class,
                        "endpoint": endpoint_filter,
                    },
                }
            )

        except Exception as e:
            logger.error(f"Error log fetch error: {e}")
            return jsonify({"error": "Failed to fetch error log"}), 500
