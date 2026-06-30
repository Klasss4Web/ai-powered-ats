"""
CV Builder routes for ATS Matcher Backend (PostgreSQL)
"""

import json
from flask import jsonify, g, request
from db.database import get_db
from auth.auth import token_required
from routes.usage import check_usage_limit, record_usage
from config import MAX_CV_PROFILES
from services.llm_service import llm_call
from routes.resume import validate_resume_file, extract_text_from_pdf
from logger.app_logger import logger


# ---------------------------
# CV PROFILE SCHEMA HELPERS
# ---------------------------
def _default_profile_data():
    """Return a clean empty CV profile structure."""
    return {
        "contact": {
            "full_name": "",
            "email": "",
            "phone": "",
            "location": "",
            "linkedin": "",
            "portfolio": "",
        },
        "summary": "",
        "experience": [],
        "education": [],
        "skills": {
            "technical": [],
            "tools": [],
            "soft": [],
            "languages": [],
        },
        "certifications": [],
        "projects": [],
        "awards": [],
        "publications": [],
    }


def _merge_profile_data(existing, updates):
    """
    Deep-merge partial updates into existing profile_data.
    Lists inside experience/education/projects are replaced, not merged item-by-item,
    to keep the operation predictable for the frontend.
    """
    result = dict(existing)
    for key, value in updates.items():
        if key in ("experience", "education", "projects", "certifications", "awards", "publications"):
            if isinstance(value, list):
                result[key] = value
        elif key == "skills" and isinstance(value, dict):
            result["skills"] = {**result.get("skills", {}), **value}
        elif key == "contact" and isinstance(value, dict):
            result["contact"] = {**result.get("contact", {}), **value}
        else:
            result[key] = value
    return result


# ---------------------------
# LLM PARSE PROMPT
# ---------------------------
def _build_parse_prompt(resume_text):
    return f"""You are an expert resume parser. Extract the following resume into a structured JSON format.

Resume Text:
{resume_text}

Return ONLY valid JSON with this exact structure:
{{
    "contact": {{
        "full_name": "",
        "email": "",
        "phone": "",
        "location": "",
        "linkedin": "",
        "portfolio": ""
    }},
    "summary": "",
    "experience": [
        {{
            "title": "",
            "company": "",
            "duration": "",
            "location": "",
            "achievements": [""]
        }}
    ],
    "education": [
        {{
            "degree": "",
            "institution": "",
            "year": "",
            "gpa": "",
            "details": ""
        }}
    ],
    "skills": {{
        "technical": [],
        "tools": [],
        "soft": [],
        "languages": []
    }},
    "certifications": [],
    "projects": [
        {{
            "name": "",
            "description": "",
            "technologies": []
        }}
    ],
    "awards": [],
    "publications": []
}}

Rules:
- Return ONLY valid JSON. No markdown, no extra text.
- Use empty strings or empty arrays for missing fields.
- within "experience", each entry must have "achievements" as an array of bullet-point strings.
- within "education", "gpa" and "details" are optional.
- within "skills", populate as many categories as possible. If a skill is a programming language or framework, put it in "technical". If it's a software tool (e.g., Git, Jira, Figma), put it in "tools". If it's a language, put it in "languages".
- If the resume does not contain enough detail for a section, use an empty array or string.
"""


# ---------------------------
# ROUTES
# ---------------------------
def register_cv_routes(app):
    # ---------------------------
    # PARSE RESUME TO STRUCTURED CV DATA
    # ---------------------------
    @app.route("/api/cv/parse", methods=["POST"])
    @token_required
    def parse_resume():
        """Parse an uploaded PDF or raw text into structured profile_data JSON."""
        logger.info(f"CV parse request from user {g.user_id}")

        can_use, message = check_usage_limit(g.user_id, "analysis")
        if not can_use:
            logger.warning(f"Usage limit exceeded for user {g.user_id}: {message}")
            return jsonify({"error": message}), 429

        # Accept either file upload or raw text
        resume_text = None
        if "resume" in request.files:
            resume_file = request.files["resume"]
            valid, err = validate_resume_file(resume_file)
            if not valid:
                logger.warning(f"Invalid resume file from user {g.user_id}: {err}")
                return jsonify({"error": err}), 400
            resume_text = extract_text_from_pdf(resume_file.stream)
            if not resume_text:
                return jsonify({"error": "Could not extract text from PDF"}), 400
        elif request.is_json and request.json.get("resume_text"):
            resume_text = request.json["resume_text"]
        else:
            return jsonify({"error": "No resume file or text provided"}), 400

        try:
            response_text = llm_call(_build_parse_prompt(resume_text), endpoint="/api/cv/parse")
            json_string = response_text.strip().replace("```json", "").replace("```", "")
            start = json_string.find("{")
            end = json_string.rfind("}") + 1
            json_string = json_string[start:end]
            parsed_data = json.loads(json_string)

            # Ensure every expected key exists
            default = _default_profile_data()
            for key in default:
                if key not in parsed_data:
                    parsed_data[key] = default[key]

            record_usage(g.user_id, "cv_parse", {})
            return jsonify({"profile_data": parsed_data})

        except json.JSONDecodeError as e:
            logger.error(f"CV parse JSON error for user {g.user_id}: {e}")
            return jsonify({"error": "Failed to parse resume structure"}), 500
        except Exception as e:
            logger.error(f"CV parse error for user {g.user_id}: {e}")
            return jsonify({"error": "Failed to parse resume"}), 500

    # ---------------------------
    # CREATE CV PROFILE
    # ---------------------------
    @app.route("/api/cv/profiles", methods=["POST"])
    @token_required
    def create_cv_profile():
        """Create a new CV profile."""
        logger.info(f"Create CV profile request from user {g.user_id}")

        data = request.json
        if not data or not data.get("title"):
            return jsonify({"error": "Title is required"}), 400

        db = get_db()
        cursor = db.cursor()

        # Check limit
        cursor.execute(
            "SELECT COUNT(*) AS count FROM cv_profiles WHERE user_id = %s",
            (g.user["id"],),
        )
        count = cursor.fetchone()["count"]
        limit = MAX_CV_PROFILES.get(g.user["subscription_type"], 1)
        if count >= limit:
            return jsonify({"error": f"CV profile limit reached ({limit})."}), 400

        profile_data = data.get("profile_data", _default_profile_data())
        template_id = data.get("template_id", 1)
        is_master = data.get("is_master", False)
        target_job_description = data.get("target_job_description")
        tailored_from_id = data.get("tailored_from_id")

        cursor.execute(
            """
            INSERT INTO cv_profiles (user_id, title, profile_data, template_id, is_master, target_job_description, tailored_from_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, created_at
            """,
            (
                g.user["id"],
                data["title"],
                json.dumps(profile_data),
                template_id,
                is_master,
                target_job_description,
                tailored_from_id,
            ),
        )
        result = cursor.fetchone()
        db.commit()

        return jsonify(
            {
                "message": "CV profile created",
                "profile": {
                    "id": result["id"],
                    "title": data["title"],
                    "template_id": template_id,
                    "is_master": is_master,
                    "created_at": result["created_at"].isoformat() if result["created_at"] else None,
                },
            }
        ), 201

    # ---------------------------
    # LIST CV PROFILES
    # ---------------------------
    @app.route("/api/cv/profiles", methods=["GET"])
    @token_required
    def list_cv_profiles():
        """List all CV profiles for the authenticated user."""
        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            """
            SELECT id, title, template_id, is_master, tailored_from_id, created_at, updated_at
            FROM cv_profiles
            WHERE user_id = %s
            ORDER BY updated_at DESC, created_at DESC
            """,
            (g.user["id"],),
        )
        profiles = cursor.fetchall()

        return jsonify(
            {
                "profiles": [
                    {
                        "id": p["id"],
                        "title": p["title"],
                        "template_id": p["template_id"],
                        "is_master": p["is_master"],
                        "tailored_from_id": p["tailored_from_id"],
                        "created_at": p["created_at"].isoformat() if p["created_at"] else None,
                        "updated_at": p["updated_at"].isoformat() if p["updated_at"] else None,
                    }
                    for p in profiles
                ]
            }
        )

    # ---------------------------
    # GET SINGLE CV PROFILE
    # ---------------------------
    @app.route("/api/cv/profiles/<int:profile_id>", methods=["GET"])
    @token_required
    def get_cv_profile(profile_id):
        """Get a single CV profile with full profile_data."""
        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            """
            SELECT id, title, profile_data, template_id, is_master, target_job_description, tailored_from_id, created_at, updated_at
            FROM cv_profiles
            WHERE id = %s AND user_id = %s
            """,
            (profile_id, g.user["id"]),
        )
        profile = cursor.fetchone()

        if not profile:
            return jsonify({"error": "CV profile not found"}), 404

        profile_data = profile["profile_data"]
        if isinstance(profile_data, str):
            profile_data = json.loads(profile_data)

        return jsonify(
            {
                "id": profile["id"],
                "title": profile["title"],
                "profile_data": profile_data,
                "template_id": profile["template_id"],
                "is_master": profile["is_master"],
                "target_job_description": profile["target_job_description"],
                "tailored_from_id": profile["tailored_from_id"],
                "created_at": profile["created_at"].isoformat() if profile["created_at"] else None,
                "updated_at": profile["updated_at"].isoformat() if profile["updated_at"] else None,
            }
        )

    # ---------------------------
    # UPDATE CV PROFILE
    # ---------------------------
    @app.route("/api/cv/profiles/<int:profile_id>", methods=["PUT"])
    @token_required
    def update_cv_profile(profile_id):
        """Update a CV profile. Accepts partial updates (merge into profile_data)."""
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        db = get_db()
        cursor = db.cursor()

        # Fetch existing profile
        cursor.execute(
            "SELECT profile_data, title FROM cv_profiles WHERE id = %s AND user_id = %s",
            (profile_id, g.user["id"]),
        )
        row = cursor.fetchone()
        if not row:
            return jsonify({"error": "CV profile not found"}), 404

        existing_profile_data = row["profile_data"]
        if isinstance(existing_profile_data, str):
            existing_profile_data = json.loads(existing_profile_data)

        # Merge updates
        updated_profile_data = _merge_profile_data(
            existing_profile_data, data.get("profile_data", {})
        )

        # Update scalar fields if provided
        title = data.get("title", row["title"])
        template_id = data.get("template_id")
        is_master = data.get("is_master")
        target_job_description = data.get("target_job_description")

        # Build dynamic update to avoid overwriting unchanged columns
        set_clauses = ["profile_data = %s", "updated_at = CURRENT_TIMESTAMP"]
        params = [json.dumps(updated_profile_data)]

        if "title" in data:
            set_clauses.append("title = %s")
            params.append(title)
        if "template_id" in data:
            set_clauses.append("template_id = %s")
            params.append(template_id)
        if "is_master" in data:
            set_clauses.append("is_master = %s")
            params.append(is_master)
        if "target_job_description" in data:
            set_clauses.append("target_job_description = %s")
            params.append(target_job_description)

        params.append(profile_id)
        params.append(g.user["id"])

        cursor.execute(
            f"""
            UPDATE cv_profiles
            SET {', '.join(set_clauses)}
            WHERE id = %s AND user_id = %s
            RETURNING id, updated_at
            """,
            params,
        )
        result = cursor.fetchone()
        db.commit()

        return jsonify(
            {
                "message": "CV profile updated",
                "id": result["id"],
                "updated_at": result["updated_at"].isoformat() if result["updated_at"] else None,
            }
        )

    # ---------------------------
    # DELETE CV PROFILE
    # ---------------------------
    @app.route("/api/cv/profiles/<int:profile_id>", methods=["DELETE"])
    @token_required
    def delete_cv_profile(profile_id):
        """Delete a CV profile."""
        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            "DELETE FROM cv_profiles WHERE id = %s AND user_id = %s RETURNING id",
            (profile_id, g.user["id"]),
        )
        deleted = cursor.fetchone()
        db.commit()

        if not deleted:
            return jsonify({"error": "CV profile not found"}), 404

        return jsonify({"message": "CV profile deleted"})
