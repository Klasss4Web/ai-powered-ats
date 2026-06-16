"""
Job Application Tracker Routes (Kanban Board)
"""

import json
from datetime import datetime
from flask import jsonify, g, request
from db.database import get_db
from logger.app_logger import logger
from config import PREMIUM_TIERS


def register_application_routes(app):
    from auth.auth import token_required

    STAGES = ["applied", "phone_screen", "interview", "offer", "accepted", "rejected", "ghosted"]

    # ---------------------------
    # LIST APPLICATIONS
    # ---------------------------
    @app.route("/api/applications", methods=["GET"])
    @token_required
    def list_applications():
        """List all job applications for the current user."""
        try:
            db = get_db()
            cursor = db.cursor()
            cursor.execute(
                """
                SELECT
                    ja.id,
                    ja.company_name,
                    ja.job_title,
                    ja.job_description,
                    ja.stage,
                    ja.salary_min,
                    ja.salary_max,
                    ja.currency,
                    ja.location,
                    ja.remote_type,
                    ja.application_date,
                    ja.contact_name,
                    ja.contact_email,
                    ja.notes,
                    ja.resume_id,
                    ja.analysis_id,
                    ja.created_at,
                    ja.updated_at,
                    sr.filename AS resume_filename,
                    a.overall_match_score
                FROM job_applications ja
                LEFT JOIN saved_resumes sr ON ja.resume_id = sr.id
                LEFT JOIN analyses a ON ja.analysis_id = a.id
                WHERE ja.user_id = %s
                ORDER BY ja.updated_at DESC
                """,
                (g.user_id,),
            )
            rows = cursor.fetchall()

            # Fetch stage history for each application
            app_ids = [r["id"] for r in rows]
            history_map = {}
            if app_ids:
                cursor.execute(
                    """
                    SELECT id, application_id, from_stage, to_stage, notes, created_at
                    FROM application_stage_history
                    WHERE application_id = ANY(%s)
                    ORDER BY created_at DESC
                    """,
                    (app_ids,),
                )
                for h in cursor.fetchall():
                    history_map.setdefault(h["application_id"], []).append(dict(h))

            applications = []
            for r in rows:
                d = dict(r)
                d["stage_history"] = history_map.get(r["id"], [])
                # Serialize dates
                for key in ["application_date", "created_at", "updated_at"]:
                    if d.get(key) and hasattr(d[key], "isoformat"):
                        d[key] = d[key].isoformat()
                for h in d["stage_history"]:
                    if h.get("created_at") and hasattr(h["created_at"], "isoformat"):
                        h["created_at"] = h["created_at"].isoformat()
                applications.append(d)

            return jsonify({"applications": applications}), 200

        except Exception as e:
            logger.error(f"List applications error: {e}")
            return jsonify({"error": "Failed to fetch applications"}), 500

    # ---------------------------
    # CREATE APPLICATION
    # ---------------------------
    @app.route("/api/applications", methods=["POST"])
    @token_required
    def create_application():
        """Create a new job application."""
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        company_name = (data.get("company_name") or "").strip()
        job_title = (data.get("job_title") or "").strip()

        if not company_name or not job_title:
            return jsonify({"error": "company_name and job_title are required"}), 400

        stage = data.get("stage", "applied")
        if stage not in STAGES:
            return jsonify({"error": f"Invalid stage. Must be one of: {', '.join(STAGES)}"}), 400

        try:
            db = get_db()
            cursor = db.cursor()
            cursor.execute(
                """
                INSERT INTO job_applications (
                    user_id, company_name, job_title, job_description, stage,
                    salary_min, salary_max, currency, location, remote_type,
                    application_date, contact_name, contact_email, notes,
                    resume_id, analysis_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (
                    g.user_id,
                    company_name,
                    job_title,
                    data.get("job_description", ""),
                    stage,
                    data.get("salary_min"),
                    data.get("salary_max"),
                    data.get("currency", "USD"),
                    data.get("location", ""),
                    data.get("remote_type", ""),
                    data.get("application_date") or datetime.now().date(),
                    data.get("contact_name", ""),
                    data.get("contact_email", ""),
                    data.get("notes", ""),
                    data.get("resume_id"),
                    data.get("analysis_id"),
                ),
            )
            result = cursor.fetchone()

            # Record initial stage history
            cursor.execute(
                """
                INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes)
                VALUES (%s, %s, %s, %s)
                """,
                (result["id"], None, stage, "Application created"),
            )

            db.commit()
            return jsonify({
                "message": "Application created",
                "application": {
                    "id": result["id"],
                    "company_name": company_name,
                    "job_title": job_title,
                    "stage": stage,
                    "created_at": result["created_at"].isoformat() if result["created_at"] else None,
                },
            }), 201

        except Exception as e:
            logger.error(f"Create application error: {e}")
            return jsonify({"error": "Failed to create application"}), 500

    # ---------------------------
    # UPDATE APPLICATION
    # ---------------------------
    @app.route("/api/applications/<int:application_id>", methods=["PUT"])
    @token_required
    def update_application(application_id):
        """Update an existing job application."""
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        try:
            db = get_db()
            cursor = db.cursor()

            # Fetch current application
            cursor.execute(
                "SELECT * FROM job_applications WHERE id = %s AND user_id = %s",
                (application_id, g.user_id),
            )
            app_row = cursor.fetchone()
            if not app_row:
                return jsonify({"error": "Application not found"}), 404

            fields = []
            values = []
            allowed_fields = [
                "company_name", "job_title", "job_description", "stage",
                "salary_min", "salary_max", "currency", "location",
                "remote_type", "application_date", "contact_name",
                "contact_email", "notes", "resume_id", "analysis_id",
            ]

            for field in allowed_fields:
                if field in data:
                    fields.append(f"{field} = %s")
                    values.append(data[field])

            if not fields:
                return jsonify({"error": "No valid fields to update"}), 400

            values.extend([application_id, g.user_id])
            cursor.execute(
                f"UPDATE job_applications SET {', '.join(fields)}, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND user_id = %s RETURNING id",
                tuple(values),
            )
            updated = cursor.fetchone()
            db.commit()

            if not updated:
                return jsonify({"error": "Application not found"}), 404

            # If stage changed, record history
            new_stage = data.get("stage")
            if new_stage and new_stage != app_row["stage"] and new_stage in STAGES:
                cursor.execute(
                    """
                    INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes)
                    VALUES (%s, %s, %s, %s)
                    """,
                    (application_id, app_row["stage"], new_stage, data.get("stage_notes", "")),
                )
                db.commit()

            return jsonify({"message": "Application updated"}), 200

        except Exception as e:
            logger.error(f"Update application error: {e}")
            return jsonify({"error": "Failed to update application"}), 500

    # ---------------------------
    # DELETE APPLICATION
    # ---------------------------
    @app.route("/api/applications/<int:application_id>", methods=["DELETE"])
    @token_required
    def delete_application(application_id):
        """Delete a job application."""
        try:
            db = get_db()
            cursor = db.cursor()
            cursor.execute(
                "DELETE FROM job_applications WHERE id = %s AND user_id = %s RETURNING id",
                (application_id, g.user_id),
            )
            deleted = cursor.fetchone()
            db.commit()
            if not deleted:
                return jsonify({"error": "Application not found"}), 404
            return jsonify({"message": "Application deleted"}), 200
        except Exception as e:
            logger.error(f"Delete application error: {e}")
            return jsonify({"error": "Failed to delete application"}), 500

    # ---------------------------
    # GET APPLICATION DETAIL
    # ---------------------------
    @app.route("/api/applications/<int:application_id>", methods=["GET"])
    @token_required
    def get_application(application_id):
        """Get a single application with full details."""
        try:
            db = get_db()
            cursor = db.cursor()
            cursor.execute(
                """
                SELECT
                    ja.*,
                    sr.filename AS resume_filename,
                    sr.resume_text AS resume_text,
                    a.result AS analysis_result,
                    a.overall_match_score
                FROM job_applications ja
                LEFT JOIN saved_resumes sr ON ja.resume_id = sr.id
                LEFT JOIN analyses a ON ja.analysis_id = a.id
                WHERE ja.id = %s AND ja.user_id = %s
                """,
                (application_id, g.user_id),
            )
            row = cursor.fetchone()
            if not row:
                return jsonify({"error": "Application not found"}), 404

            # Fetch stage history
            cursor.execute(
                """
                SELECT id, from_stage, to_stage, notes, created_at
                FROM application_stage_history
                WHERE application_id = %s
                ORDER BY created_at DESC
                """,
                (application_id,),
            )
            history = cursor.fetchall()

            app_data = dict(row)
            app_data["stage_history"] = [dict(h) for h in history]

            # Serialize dates
            for key in ["application_date", "created_at", "updated_at"]:
                if app_data.get(key) and hasattr(app_data[key], "isoformat"):
                    app_data[key] = app_data[key].isoformat()
            for h in app_data["stage_history"]:
                if h.get("created_at") and hasattr(h["created_at"], "isoformat"):
                    h["created_at"] = h["created_at"].isoformat()

            # Deserialize JSONB
            if app_data.get("analysis_result") and isinstance(app_data["analysis_result"], str):
                app_data["analysis_result"] = json.loads(app_data["analysis_result"])

            return jsonify({"application": app_data}), 200

        except Exception as e:
            logger.error(f"Get application error: {e}")
            return jsonify({"error": "Failed to fetch application"}), 500

    # ---------------------------
    # ADD STAGE HISTORY NOTE
    # ---------------------------
    @app.route("/api/applications/<int:application_id>/history", methods=["POST"])
    @token_required
    def add_stage_history(application_id):
        """Add a stage history entry manually."""
        data = request.json
        if not data or not data.get("to_stage"):
            return jsonify({"error": "to_stage is required"}), 400

        to_stage = data["to_stage"]
        if to_stage not in STAGES:
            return jsonify({"error": f"Invalid stage. Must be one of: {', '.join(STAGES)}"}), 400

        try:
            db = get_db()
            cursor = db.cursor()

            # Verify ownership
            cursor.execute(
                "SELECT stage FROM job_applications WHERE id = %s AND user_id = %s",
                (application_id, g.user_id),
            )
            row = cursor.fetchone()
            if not row:
                return jsonify({"error": "Application not found"}), 404

            from_stage = data.get("from_stage", row["stage"])

            cursor.execute(
                """
                INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes)
                VALUES (%s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (application_id, from_stage, to_stage, data.get("notes", "")),
            )
            result = cursor.fetchone()

            # Update application stage if it's different
            if to_stage != row["stage"]:
                cursor.execute(
                    "UPDATE job_applications SET stage = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (to_stage, application_id),
                )

            db.commit()
            return jsonify({
                "message": "Stage history added",
                "history": {
                    "id": result["id"],
                    "from_stage": from_stage,
                    "to_stage": to_stage,
                    "created_at": result["created_at"].isoformat() if result["created_at"] else None,
                },
            }), 201

        except Exception as e:
            logger.error(f"Add stage history error: {e}")
            return jsonify({"error": "Failed to add stage history"}), 500
