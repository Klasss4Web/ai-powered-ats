"""
Feature Flags System
Supports:
- Boolean on/off toggles
- Percentage-based rollouts (deterministic per-user)
- A/B variant assignment (control / variant_a / variant_b)
- Maintenance mode gating
"""

import hashlib
import json
from flask import jsonify, g, request
from db.database import get_db
from logger.app_logger import logger


def _user_flag_hash(user_id, flag_key):
    """Deterministic hash 0-99 for percentage-based rollouts."""
    h = hashlib.md5(f"{flag_key}:{user_id}".encode()).hexdigest()
    return int(h, 16) % 100


def check_feature_flag(flag_key, user_id=None):
    """
    Check if a feature flag is enabled for a user.
    Returns bool.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "SELECT enabled, rollout_pct FROM feature_flags WHERE flag_key = %s",
            (flag_key,),
        )
        row = cursor.fetchone()

        if not row:
            return True  # default: enabled if not configured

        if not row["enabled"]:
            return False

        if row["rollout_pct"] >= 100:
            return True

        if user_id is None:
            return False  # no user = treat as not rolled out

        bucket = _user_flag_hash(user_id, flag_key)
        return bucket < row["rollout_pct"]

    except Exception as e:
        logger.error(f"Feature flag check error for {flag_key}: {e}")
        return True  # fail-open


def get_feature_variant(flag_key, user_id=None):
    """
    Get the A/B variant for a user.
    Returns 'control' or whatever variant is stored.
    If the flag is disabled or user not rolled out, returns None.
    """
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute(
            "SELECT enabled, rollout_pct, variant FROM feature_flags WHERE flag_key = %s",
            (flag_key,),
        )
        row = cursor.fetchone()

        if not row:
            return "control"

        if not row["enabled"]:
            return None

        if row["rollout_pct"] < 100 and user_id is not None:
            bucket = _user_flag_hash(user_id, flag_key)
            if bucket >= row["rollout_pct"]:
                return None

        return row["variant"] or "control"

    except Exception as e:
        logger.error(f"Feature variant check error for {flag_key}: {e}")
        return "control"


def _resolve_flags(user_id):
    """Return all flags with resolved state for a user."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute(
        "SELECT flag_key, enabled, rollout_pct, variant, metadata FROM feature_flags"
    )
    rows = cursor.fetchall()
    result = {}
    for r in rows:
        flag_key = r["flag_key"]
        is_enabled = check_feature_flag(flag_key, user_id)
        variant = get_feature_variant(flag_key, user_id)
        result[flag_key] = {
            "enabled": is_enabled,
            "variant": variant,
            "rollout_pct": r["rollout_pct"],
            "metadata": r["metadata"],
        }
    return result


def register_feature_routes(app):
    from auth.auth import token_required, admin_required

    # ---------------------------
    # GET FEATURES (for current user)
    # ---------------------------
    @app.route("/api/features", methods=["GET"])
    @token_required
    def get_features():
        """Return all feature flags resolved for the current user."""
        try:
            flags = _resolve_flags(g.user_id)
            return jsonify({"flags": flags}), 200
        except Exception as e:
            logger.error(f"Get features error: {e}")
            return jsonify({"flags": {}}), 200  # fail-open

    # ---------------------------
    # ADMIN: LIST FLAGS
    # ---------------------------
    @app.route("/api/admin/feature-flags", methods=["GET"])
    @admin_required
    def list_feature_flags():
        """Admin: list all raw feature flags."""
        try:
            db = get_db()
            cursor = db.cursor()
            cursor.execute(
                """
                SELECT id, flag_key, enabled, rollout_pct, variant, metadata, updated_at
                FROM feature_flags
                ORDER BY flag_key
                """
            )
            rows = cursor.fetchall()
            flags = []
            for r in rows:
                d = dict(r)
                if d.get("updated_at") and hasattr(d["updated_at"], "isoformat"):
                    d["updated_at"] = d["updated_at"].isoformat()
                flags.append(d)
            return jsonify({"flags": flags}), 200
        except Exception as e:
            logger.error(f"List feature flags error: {e}")
            return jsonify({"error": "Failed to list feature flags"}), 500

    # ---------------------------
    # ADMIN: UPSERT FLAG
    # ---------------------------
    @app.route("/api/admin/feature-flags", methods=["POST"])
    @admin_required
    def upsert_feature_flag():
        """Admin: create or update a feature flag."""
        data = request.json
        if not data or not data.get("flag_key"):
            return jsonify({"error": "flag_key is required"}), 400

        flag_key = data["flag_key"]
        enabled = data.get("enabled", True)
        rollout_pct = data.get("rollout_pct", 100)
        variant = data.get("variant", "control")
        metadata = data.get("metadata", {})

        if not isinstance(rollout_pct, int) or not (0 <= rollout_pct <= 100):
            return jsonify({"error": "rollout_pct must be between 0 and 100"}), 400

        try:
            db = get_db()
            cursor = db.cursor()
            cursor.execute(
                """
                INSERT INTO feature_flags (flag_key, enabled, rollout_pct, variant, metadata)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (flag_key)
                DO UPDATE SET
                    enabled = EXCLUDED.enabled,
                    rollout_pct = EXCLUDED.rollout_pct,
                    variant = EXCLUDED.variant,
                    metadata = EXCLUDED.metadata,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
                """,
                (flag_key, enabled, rollout_pct, variant, json.dumps(metadata)),
            )
            result = cursor.fetchone()
            db.commit()
            return jsonify({"message": "Feature flag saved", "id": result["id"]}), 200
        except Exception as e:
            logger.error(f"Upsert feature flag error: {e}")
            return jsonify({"error": "Failed to save feature flag"}), 500

    # ---------------------------
    # ADMIN: DELETE FLAG
    # ---------------------------
    @app.route("/api/admin/feature-flags/<flag_key>", methods=["DELETE"])
    @admin_required
    def delete_feature_flag(flag_key):
        """Admin: delete a feature flag."""
        try:
            db = get_db()
            cursor = db.cursor()
            cursor.execute(
                "DELETE FROM feature_flags WHERE flag_key = %s RETURNING id",
                (flag_key,),
            )
            result = cursor.fetchone()
            db.commit()
            if not result:
                return jsonify({"error": "Feature flag not found"}), 404
            return jsonify({"message": "Feature flag deleted"}), 200
        except Exception as e:
            logger.error(f"Delete feature flag error: {e}")
            return jsonify({"error": "Failed to delete feature flag"}), 500
