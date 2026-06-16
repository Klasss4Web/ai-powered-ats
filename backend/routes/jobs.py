"""
Background Job API Routes
"""

from flask import jsonify, g
from auth.auth import token_required
from jobs.worker import get_job_status


def register_job_routes(app):

    @app.route("/api/jobs/<int:job_id>/status", methods=["GET"])
    @token_required
    def job_status(job_id):
        """Poll endpoint for job progress."""
        status = get_job_status(job_id, g.user_id)
        if status is None:
            return jsonify({"error": "Job not found"}), 404
        return jsonify(status), 200
