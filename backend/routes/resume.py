"""
Resume processing, generation, and matching for ATS Matcher Backend (PostgreSQL)
"""

import json
import time
from logger.app_logger import logger, log_llm_call
import os
import datetime
import PyPDF2
from io import BytesIO
from docx import Document
from flask import jsonify, g, request, send_file
from db.database import get_db
from routes.usage import check_usage_limit, record_usage
from config import MAX_SAVED_RESUMES, MAX_BATCH_RESUMES
from openai import OpenAI, AsyncOpenAI


# ---------------------------
# LLM INITIALIZATION
# ---------------------------

MODEL = "openai/gpt-oss-120b"

try:
    api_key = os.getenv("OPENROUTER_API_KEY")

    if api_key:
        model = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            timeout=60.0,
            max_retries=3,
        )
        logger.info(f"LLM client initialized successfully with model: {MODEL}")
    else:
        model = None
        logger.warning("OPENROUTER_API_KEY not set - LLM features disabled")

except Exception as e:
    logger.error(f"ERROR initializing LLM client: {e}")
    model = None


# ---------------------------
# LLM CALL WRAPPER
# ---------------------------
def llm_call(prompt, endpoint="unknown"):
    if not model:
        logger.error(f"LLM call failed for {endpoint}: model not initialized")
        raise RuntimeError("LLM model not initialized")

    start_time = time.time()
    logger.info(f"LLM call started: {endpoint}")

    try:
        response = model.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL,
            timeout=60,
        )

        duration_ms = (time.time() - start_time) * 1000

        # Track token usage
        usage = response.usage
        prompt_tokens = usage.prompt_tokens if usage else 0
        completion_tokens = usage.completion_tokens if usage else 0
        total_tokens = usage.total_tokens if usage else 0

        if usage:
            record_token_usage(
                endpoint=endpoint,
                model=MODEL,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
            )

        log_llm_call(
            endpoint=endpoint,
            model=MODEL,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            duration_ms=round(duration_ms, 2),
            success=True,
        )

        return response.choices[0].message.content

    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        log_llm_call(
            endpoint=endpoint,
            model=MODEL,
            duration_ms=round(duration_ms, 2),
            success=False,
            error=str(e),
        )
        raise


def record_token_usage(endpoint, model, prompt_tokens, completion_tokens, total_tokens):
    """Record token usage to the database."""
    # Estimate cost (This will be adjusted based on the model in use and actual pricing)
    # OpenRouter pricing varies by model, using approximate values
    cost_per_1k_prompt = 0.001  # $0.001 per 1K prompt tokens
    cost_per_1k_completion = 0.002  # $0.002 per 1K completion tokens
    estimated_cost = (prompt_tokens / 1000 * cost_per_1k_prompt) + (
        completion_tokens / 1000 * cost_per_1k_completion
    )

    try:
        db = get_db()
        cursor = db.cursor()

        # Get user_id from Flask g if available
        user_id = getattr(g, "user_id", None)

        cursor.execute(
            """
            INSERT INTO token_usage (user_id, endpoint, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
            (
                user_id,
                endpoint,
                model,
                prompt_tokens,
                completion_tokens,
                total_tokens,
                estimated_cost,
            ),
        )

        db.commit()
    except Exception as e:
        logger.error(f"Error recording token usage: {e}")


# ---------------------------
# PDF TEXT EXTRACTION
# ---------------------------
def extract_text_from_pdf(pdf_stream):
    try:
        reader = PyPDF2.PdfReader(pdf_stream)
        text = ""

        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"

        return text

    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return None


# ---------------------------
# STANDARD RESUME GENERATION
# ---------------------------
def generate_standard_resume_pdf(resume_text):
    parse_prompt = f"""
    Parse the following resume text into structured JSON format for a professional CV.
    
    Resume Text:
    {resume_text}
    
    Extract and structure the information into the following sections:
    - name: Full name of the person (string)
    - contact: Object with email, phone, location, linkedin (strings, use empty string if not found)
    - summary: Professional summary or objective (string, use empty string if not present)
    - experience: Array of work experience objects, each with: title (string), company (string), duration (string), location (string), description (array of strings)
    - education: Array of education objects, each with: degree (string), institution (string), year (string), gpa (string)
    - skills: Array of technical/professional skills (strings only)
    - certifications: Array of certification names (strings only, no JSON formatting)
    - projects: Array of project objects, each with: name (string), description (string or array of strings), technologies (array of strings)
    
    IMPORTANT: 
    - Return ONLY valid JSON. Do not add any other text.
    - All string values should be plain text without quotes, brackets, or JSON formatting.
    - Arrays should contain only the actual content strings.
    - If a section is not present, use empty array [] or empty string "".
    - Do not include any JSON-like formatting in the string values themselves.
    """

    try:
        response_text = llm_call(parse_prompt, endpoint="/api/generate-cv")

        json_string = response_text.strip().replace("```json", "").replace("```", "")
        start = json_string.find("{")
        end = json_string.rfind("}") + 1
        json_string = json_string[start:end]

        parsed_data = json.loads(json_string)

    except Exception as e:
        logger.error(f"Parsing error: {e}")
        parsed_data = {
            "name": "Professional Name",
            "contact": {},
            "summary": "",
            "experience": [],
            "education": [],
            "skills": [],
            "certifications": [],
            "projects": [],
        }

    # ---------------------------
    # PDF GENERATION
    # ---------------------------
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib import colors

    pdf_stream = BytesIO()
    doc = SimpleDocTemplate(pdf_stream, pagesize=letter)

    styles = getSampleStyleSheet()
    story = []

    # Header
    story.append(Paragraph(parsed_data.get("name", "Name"), styles["Title"]))

    contact = parsed_data.get("contact", {})
    contact_line = " | ".join(
        filter(
            None,
            [
                contact.get("email", ""),
                contact.get("phone", ""),
                contact.get("location", ""),
            ],
        )
    )

    story.append(Paragraph(contact_line, styles["Normal"]))
    story.append(Spacer(1, 12))

    # Summary
    if parsed_data.get("summary"):
        story.append(Paragraph("SUMMARY", styles["Heading2"]))
        story.append(Paragraph(parsed_data["summary"], styles["Normal"]))

    doc.build(story)
    pdf_stream.seek(0)
    return pdf_stream


# ---------------------------
# DOCX GENERATION
# ---------------------------
def generate_optimized_resume_docx(original_text, missing_skills, analysis_data=None):
    doc = Document()
    doc.add_heading("Optimized Resume Suggestions", 1)

    doc.add_heading("Missing Skills", 2)
    for skill in missing_skills:
        doc.add_paragraph(skill, style="List Bullet")

    doc.add_heading("Original Resume", 2)
    doc.add_paragraph(original_text)

    stream = BytesIO()
    doc.save(stream)
    stream.seek(0)
    return stream


# ---------------------------
# ROUTES
# ---------------------------
def register_resume_routes(app):
    from auth.auth import token_required

    # ---------------------------
    # MATCH RESUME
    # ---------------------------
    @app.route("/api/match", methods=["POST"])
    @token_required
    def process_match():
        logger.info(f"Resume match request from user {g.user_id}")

        can_use, message = check_usage_limit(g.user_id, "analysis")
        if not can_use:
            logger.warning(f"Usage limit exceeded for user {g.user_id}: {message}")
            return jsonify({"error": message}), 429

        if not model:
            logger.error("LLM not available for resume match")
            return jsonify({"error": "LLM not available"}), 500

        if "job_description" not in request.form:
            logger.warning(f"Missing job description in request from user {g.user_id}")
            return jsonify({"error": "Missing job description"}), 400

        job_description = request.form["job_description"]

        # Resume input - either file upload or saved resume ID
        if "resume" in request.files:
            resume_file = request.files["resume"]
            logger.debug(f"Processing resume file: {resume_file.filename}")
            resume_text = extract_text_from_pdf(resume_file.stream)
        elif "resume_id" in request.form:
            resume_id = request.form["resume_id"]
            logger.debug(f"Using saved resume ID: {resume_id}")
            db = get_db()
            cursor = db.cursor()
            cursor.execute(
                "SELECT resume_text FROM saved_resumes WHERE id = %s AND user_id = %s",
                (resume_id, g.user["id"]),
            )
            saved_resume = cursor.fetchone()
            if not saved_resume:
                logger.warning(
                    f"Saved resume {resume_id} not found for user {g.user_id}"
                )
                return jsonify({"error": "Saved resume not found"}), 404
            resume_text = saved_resume["resume_text"]
        else:
            logger.warning(f"Missing resume in request from user {g.user_id}")
            return jsonify({"error": "Missing resume"}), 400

        if not resume_text:
            logger.error(f"Could not extract text from resume for user {g.user_id}")
            return jsonify({"error": "Could not extract resume text"}), 400

        prompt = f"""
        You are an expert Applicant Tracking System (ATS) Analyst and Resume Optimization Specialist. Your job is to compare a RESUME against a JOB DESCRIPTION with comprehensive scoring and recommendations.

        --- RESUME TEXT ---
        {resume_text}

        --- JOB DESCRIPTION TEXT ---
        {job_description}

        Analyze the two texts and provide a comprehensive evaluation:

        1. **Calculate Detailed Scores (0-100%):**
        - "keyword_match_score": Percentage of critical job keywords present in resume
        - "skills_alignment_score": How well candidate's skills align with job requirements
        - "experience_relevance_score": How relevant work experience is to the position
        - "formatting_structure_score": How well-structured resume matches ATS expectations
        - "seniority_fit_score": Whether experience level matches position seniority
        - "overall_match_score": Weighted average of all scores

        2. **Identify Matched Skills:** List 5-10 key professional skills/technologies present in BOTH documents.

        3. **Identify Missing Skills:** List 5-10 key professional skills/technologies required by JOB DESCRIPTION but NOT found in RESUME.

        4. **Identify Weakly Represented Skills:** List 3-5 skills that appear in both documents but with weak representation in the resume (mentioned once or briefly).

        5. **Identify Overused Terms:** List any keywords/phrases that appear excessively in the resume (3+ times) that should be varied.

        6. **Keyword Gap Analysis:** For missing skills, suggest specific resume sections where each could be naturally integrated.

        7. **Generate Recommendation:** Write brief (max 3 sentences), actionable advice to improve resume for this specific job.

        8. **Add to Resume Suggestions:** Provide 3-5 specific bullet points or phrases the candidate could add to their resume to improve match.

        Return results STRICTLY as a single JSON object. Do not add any other text.
        Required keys: "keyword_match_score", "skills_alignment_score", "experience_relevance_score", "formatting_structure_score", "seniority_fit_score", "overall_match_score", "matched_skills", "missing_skills", "weakly_represented_skills", "overused_terms", "keyword_gap_analysis", "recommendation_text", "add_to_resume_suggestions"

        All scores must be integers 0-100.
        All list fields must be arrays of strings.
        keyword_gap_analysis must be an object mapping missing skill to suggested resume section (e.g., {{"Python": "Technical Skills section", "Docker": "Projects section"}}).
        """

        try:
            response_text = llm_call(prompt, endpoint="/api/match")
            json_string = (
                response_text.strip().replace("```json", "").replace("```", "")
            )

            result = json.loads(json_string)

            # Include the original resume text for features like cover letter and interview prep
            result["original_resume_text"] = resume_text

            record_usage(g.user_id, "analysis", {"job": True})

            overall_score = result.get("overall_match_score", 0)
            logger.info(
                f"Resume analysis completed for user {g.user_id} | Score: {overall_score}%"
            )

            return jsonify(result)

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error in resume match for user {g.user_id}: {e}")
            return jsonify({"error": "Failed to parse analysis results"}), 500
        except Exception as e:
            logger.error(f"Resume match error for user {g.user_id}: {e}")
            return jsonify({"error": str(e)}), 500

    # ---------------------------
    # SAVE RESUME
    # ---------------------------
    @app.route("/api/resumes/save", methods=["POST"])
    @token_required
    def save_resume():
        logger.info(f"Save resume request from user {g.user_id}")

        if "resume" not in request.files:
            logger.warning(f"No resume file in save request from user {g.user_id}")
            return jsonify({"error": "No resume provided"}), 400

        file = request.files["resume"]
        text = extract_text_from_pdf(file.stream)

        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            "SELECT COUNT(*) AS count FROM saved_resumes WHERE user_id = %s",
            (g.user["id"],),
        )

        count = cursor.fetchone()["count"]
        limit = MAX_SAVED_RESUMES.get(g.user["subscription_type"], 1)

        if count >= limit:
            return jsonify({"error": "Resume limit reached"}), 400

        cursor.execute(
            """
            INSERT INTO saved_resumes (user_id, filename, resume_text)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (g.user["id"], file.filename, text),
        )

        resume_id = cursor.fetchone()["id"]
        db.commit()

        return jsonify({"id": resume_id, "message": "Saved"})

    # ---------------------------
    # GET RESUMES
    # ---------------------------
    @app.route("/api/resumes", methods=["GET"])
    @token_required
    def get_saved_resumes():
        """Get user's saved resumes."""
        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            """
            SELECT id, filename, created_at 
            FROM saved_resumes 
            WHERE user_id = %s 
            ORDER BY created_at DESC
        """,
            (g.user["id"],),
        )

        resumes = cursor.fetchall()

        return jsonify({"resumes": [dict(row) for row in resumes]})

    # ---------------------------
    # DELETE RESUME
    # ---------------------------
    @app.route("/api/resumes/<int:resume_id>", methods=["DELETE"])
    @token_required
    def delete_resume(resume_id):
        db = get_db()
        cursor = db.cursor()

        cursor.execute(
            "DELETE FROM saved_resumes WHERE id = %s AND user_id = %s",
            (resume_id, g.user["id"]),
        )

        db.commit()

        return jsonify({"message": "Deleted"})

    # ---------------------------
    # GENERATE DOCS
    # ---------------------------
    @app.route("/api/generate-cv", methods=["POST"])
    @token_required
    def generate_cv():
        data = request.json

        pdf = generate_standard_resume_pdf(data["original_resume_text"])

        return send_file(
            pdf, mimetype="application/pdf", as_attachment=True, download_name="cv.pdf"
        )

    # ---------------------------
    # GENERATE OPTIMIZED RESUME
    # ---------------------------
    @app.route("/api/generate-optimized-resume", methods=["POST"])
    @token_required
    def generate_optimized_resume():
        """
        Generate an optimized resume that incorporates missing skills and suggestions
        based on the job description analysis.
        """
        if not model:
            return jsonify({"error": "LLM not available"}), 500

        data = request.json

        if not data:
            return jsonify({"error": "No data provided"}), 400

        original_resume_text = data.get("original_resume_text", "")
        job_description = data.get("job_description", "")

        # Analysis data
        missing_skills = data.get("missing_skills", [])
        matched_skills = data.get("matched_skills", [])
        weakly_represented_skills = data.get("weakly_represented_skills", [])
        add_to_resume_suggestions = data.get("add_to_resume_suggestions", [])
        keyword_gap_analysis = data.get("keyword_gap_analysis", {})
        recommendation_text = data.get("recommendation_text", "")

        # Scores
        overall_match_score = data.get("overall_match_score", 0)
        keyword_match_score = data.get("keyword_match_score", 0)
        skills_alignment_score = data.get("skills_alignment_score", 0)

        if not original_resume_text:
            return jsonify({"error": "Original resume text is required"}), 400

        # Create an AI prompt to generate an optimized resume
        prompt = f"""You are an expert resume writer and ATS optimization specialist. Your task is to SIGNIFICANTLY REWRITE and ENHANCE the following resume based on a detailed ATS analysis to maximize the candidate's chances of passing ATS screening and getting an interview.

=== ORIGINAL RESUME ===
{original_resume_text}

=== TARGET JOB DESCRIPTION ===
{job_description}

=== ATS ANALYSIS RESULTS ===

Current Match Scores:
- Overall Match: {overall_match_score}%
- Keyword Match: {keyword_match_score}%
- Skills Alignment: {skills_alignment_score}%

AI Recommendation:
{recommendation_text if recommendation_text else "Optimize the resume to better match the job requirements."}

SKILLS ALREADY MATCHED (emphasize these more):
{", ".join(matched_skills) if matched_skills else "None identified"}

CRITICAL MISSING SKILLS (must incorporate where candidate has relevant experience):
{", ".join(missing_skills) if missing_skills else "None identified"}

WEAKLY REPRESENTED SKILLS (need to strengthen these):
{", ".join(weakly_represented_skills) if weakly_represented_skills else "None identified"}

SPECIFIC IMPROVEMENTS TO MAKE:
{chr(10).join(["- " + s for s in add_to_resume_suggestions]) if add_to_resume_suggestions else "- Improve overall keyword optimization"}

WHERE TO ADD MISSING KEYWORDS:
{chr(10).join([f"- Add '{skill}' to {section}" for skill, section in keyword_gap_analysis.items()]) if keyword_gap_analysis else "- Distribute keywords naturally throughout"}

=== YOUR TASK ===

Create an OPTIMIZED version of this resume that:

1. **PROFESSIONAL SUMMARY**: Write a powerful 3-4 sentence summary that:
   - Immediately highlights the most relevant experience for THIS job
   - Incorporates key missing skills naturally (if candidate has related experience)
   - Uses keywords from the job description
   - Quantifies experience where possible (years, team size, etc.)

2. **WORK EXPERIENCE**: For each position:
   - Rewrite bullet points to emphasize achievements relevant to the target job
   - Add metrics and quantifiable results (%, $, numbers)
   - Incorporate missing skills where the candidate likely used them
   - Use strong action verbs that match the job description language
   - Ensure each bullet demonstrates impact, not just responsibilities

3. **SKILLS SECTION**: Reorganize to:
   - Lead with the most relevant skills for this job
   - Include ALL matched skills prominently
   - Add missing skills ONLY if candidate likely has them based on experience
   - Group skills logically (Technical, Tools, Soft Skills)

4. **EDUCATION & CERTIFICATIONS**: 
   - Highlight relevant coursework, projects, or achievements
   - Add any certifications relevant to the job

5. **OVERALL OPTIMIZATION**:
   - Use terminology and keywords from the job description
   - Ensure ATS-friendly formatting
   - Strengthen weakly represented skills throughout
   - Apply ALL the specific improvements listed above

IMPORTANT RULES:
- DO NOT fabricate experience or skills the candidate doesn't have
- DO NOT add fake metrics or achievements
- DO enhance and better articulate existing experience
- DO incorporate job description keywords where truthfully applicable
- DO quantify achievements with realistic estimates based on context

Return the optimized resume in the following JSON structure:
{{
    "name": "Full Name",
    "contact": {{
        "email": "email@example.com",
        "phone": "phone number",
        "location": "City, State",
        "linkedin": "LinkedIn URL if available"
    }},
    "summary": "A compelling 3-4 sentence professional summary tailored to the job with relevant keywords",
    "experience": [
        {{
            "title": "Job Title",
            "company": "Company Name",
            "duration": "Start - End",
            "location": "City, State",
            "achievements": ["Achievement 1 with metrics and keywords", "Achievement 2 with impact", "Achievement 3"]
        }}
    ],
    "skills": {{
        "technical": ["Most relevant skill first", "skill2"],
        "tools": ["tool1", "tool2"],
        "soft": ["skill1", "skill2"]
    }},
    "education": [
        {{
            "degree": "Degree Name",
            "institution": "School Name",
            "year": "Graduation Year",
            "details": "Relevant coursework, honors, GPA if notable"
        }}
    ],
    "certifications": ["Certification 1", "Certification 2"],
    "projects": [
        {{
            "name": "Project Name",
            "description": "Brief description highlighting relevant skills",
            "technologies": ["tech1", "tech2"]
        }}
    ]
}}

Return ONLY valid JSON. Do not add any other text.
"""

        try:
            response_text = llm_call(prompt, endpoint="/api/generate-optimized-resume")

            # Parse JSON response
            json_string = (
                response_text.strip().replace("```json", "").replace("```", "")
            )
            start = json_string.find("{")
            end = json_string.rfind("}") + 1
            json_string = json_string[start:end]

            parsed_data = json.loads(json_string)

        except json.JSONDecodeError as e:
            logger.error(f"Optimized resume JSON parse error: {e}")
            return jsonify({"error": "Failed to parse optimized resume"}), 500
        except Exception as e:
            logger.error(f"Optimized resume generation error: {e}")
            return jsonify({"error": "Failed to generate optimized resume"}), 500

        # Generate PDF with optimized content
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
        )
        from reportlab.lib import colors
        from reportlab.lib.units import inch

        pdf_stream = BytesIO()
        doc = SimpleDocTemplate(
            pdf_stream,
            pagesize=letter,
            rightMargin=0.5 * inch,
            leftMargin=0.5 * inch,
            topMargin=0.5 * inch,
            bottomMargin=0.5 * inch,
        )

        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Title"],
            fontSize=18,
            spaceAfter=6,
            textColor=colors.HexColor("#1a365d"),
        )

        heading_style = ParagraphStyle(
            "CustomHeading",
            parent=styles["Heading2"],
            fontSize=12,
            spaceBefore=12,
            spaceAfter=6,
            textColor=colors.HexColor("#2c5282"),
            borderPadding=(0, 0, 3, 0),
        )

        normal_style = ParagraphStyle(
            "CustomNormal", parent=styles["Normal"], fontSize=10, leading=14
        )

        bullet_style = ParagraphStyle(
            "CustomBullet",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            leftIndent=15,
            bulletIndent=5,
        )

        story = []

        # Header - Name
        story.append(Paragraph(parsed_data.get("name", "Name"), title_style))

        # Contact Info
        contact = parsed_data.get("contact", {})
        contact_parts = []
        if contact.get("email"):
            contact_parts.append(contact["email"])
        if contact.get("phone"):
            contact_parts.append(contact["phone"])
        if contact.get("location"):
            contact_parts.append(contact["location"])
        if contact.get("linkedin"):
            contact_parts.append(contact["linkedin"])

        if contact_parts:
            contact_line = " | ".join(contact_parts)
            story.append(
                Paragraph(
                    contact_line,
                    ParagraphStyle("Contact", fontSize=9, textColor=colors.gray),
                )
            )

        story.append(Spacer(1, 12))

        # Professional Summary
        if parsed_data.get("summary"):
            story.append(Paragraph("PROFESSIONAL SUMMARY", heading_style))
            story.append(Paragraph(parsed_data["summary"], normal_style))

        # Experience
        experience = parsed_data.get("experience", [])
        if experience:
            story.append(Paragraph("PROFESSIONAL EXPERIENCE", heading_style))
            for job in experience:
                # Job title and company
                job_header = f"<b>{job.get('title', '')}</b> | {job.get('company', '')}"
                story.append(Paragraph(job_header, normal_style))

                # Duration and location
                job_details = []
                if job.get("duration"):
                    job_details.append(job["duration"])
                if job.get("location"):
                    job_details.append(job["location"])
                if job_details:
                    story.append(
                        Paragraph(
                            " | ".join(job_details),
                            ParagraphStyle(
                                "JobDetails", fontSize=9, textColor=colors.gray
                            ),
                        )
                    )

                # Achievements
                achievements = job.get("achievements", job.get("description", []))
                if isinstance(achievements, str):
                    achievements = [achievements]
                for achievement in achievements:
                    story.append(Paragraph(f"• {achievement}", bullet_style))

                story.append(Spacer(1, 6))

        # Skills
        skills = parsed_data.get("skills", [])
        if skills:
            story.append(Paragraph("SKILLS", heading_style))
            if isinstance(skills, dict):
                skill_lines = []
                # Technical skills first (most relevant for ATS)
                if skills.get("technical"):
                    skill_lines.append(
                        f"<b>Technical Skills:</b> {', '.join(skills['technical'])}"
                    )
                if skills.get("tools"):
                    skill_lines.append(
                        f"<b>Tools & Technologies:</b> {', '.join(skills['tools'])}"
                    )
                if skills.get("soft"):
                    skill_lines.append(
                        f"<b>Soft Skills:</b> {', '.join(skills['soft'])}"
                    )
                for line in skill_lines:
                    story.append(Paragraph(line, normal_style))
            elif isinstance(skills, list):
                story.append(Paragraph(", ".join(skills), normal_style))

        # Education
        education = parsed_data.get("education", [])
        if education:
            story.append(Paragraph("EDUCATION", heading_style))
            for edu in education:
                edu_line = f"<b>{edu.get('degree', '')}</b>"
                if edu.get("institution"):
                    edu_line += f" | {edu['institution']}"
                if edu.get("year"):
                    edu_line += f" | {edu['year']}"
                if edu.get("gpa"):
                    edu_line += f" | GPA: {edu['gpa']}"
                story.append(Paragraph(edu_line, normal_style))
                # Add details (relevant coursework, honors, etc.)
                if edu.get("details"):
                    story.append(
                        Paragraph(
                            edu["details"],
                            ParagraphStyle(
                                "EduDetails",
                                fontSize=9,
                                textColor=colors.gray,
                                leftIndent=15,
                            ),
                        )
                    )

        # Certifications
        certifications = parsed_data.get("certifications", [])
        if certifications:
            story.append(Paragraph("CERTIFICATIONS", heading_style))
            for cert in certifications:
                if isinstance(cert, str):
                    story.append(Paragraph(f"• {cert}", bullet_style))
                else:
                    story.append(Paragraph(f"• {str(cert)}", bullet_style))

        # Projects
        projects = parsed_data.get("projects", [])
        if projects:
            story.append(Paragraph("PROJECTS", heading_style))
            for project in projects:
                project_name = project.get("name", "")
                project_desc = project.get("description", "")
                technologies = project.get("technologies", [])

                story.append(Paragraph(f"<b>{project_name}</b>", normal_style))
                if project_desc:
                    story.append(Paragraph(project_desc, bullet_style))
                if technologies:
                    story.append(
                        Paragraph(
                            f"<i>Technologies: {', '.join(technologies)}</i>",
                            ParagraphStyle(
                                "Tech", fontSize=9, textColor=colors.gray, leftIndent=15
                            ),
                        )
                    )
                story.append(Spacer(1, 4))

        doc.build(story)
        pdf_stream.seek(0)

        return send_file(
            pdf_stream,
            mimetype="application/pdf",
            as_attachment=True,
            download_name="optimized_resume.pdf",
        )

    # ---------------------------
    # GENERATE COVER LETTER
    # ---------------------------
    @app.route("/api/generate-cover-letter", methods=["POST"])
    @token_required
    def generate_cover_letter():
        """
        Generate a human-like cover letter based on resume and job description.
        Returns plain text with no markdown formatting.
        Deducts from user's daily usage limit.
        """
        # Check usage limit
        can_use, message = check_usage_limit(g.user_id, "cover_letter")
        if not can_use:
            return jsonify({"error": message, "upgrade_required": True}), 429

        if not model:
            return jsonify({"error": "LLM not available"}), 500

        data = request.json

        if not data:
            return jsonify({"error": "No data provided"}), 400

        resume_text = data.get("resume_text", "")
        job_description = data.get("job_description", "")
        company_name = data.get("company_name", "the company")
        job_title = data.get("job_title", "the position")

        if not resume_text or not job_description:
            return jsonify(
                {"error": "Resume text and job description are required"}
            ), 400

        # Craft a prompt that generates human-like cover letters
        prompt = f"""You are a professional career coach helping a job seeker write a compelling cover letter. Your task is to write a cover letter that sounds completely natural and human-written.

CRITICAL REQUIREMENTS:
1. Write in plain text only - NO markdown, NO bullet points, NO asterisks, NO special formatting
2. The letter must sound genuinely human - use natural language, varied sentence structures, and authentic enthusiasm
3. Avoid AI-typical phrases like "I am excited to apply", "I believe I would be a great fit", "leverage my skills", "synergy", "utilize", "aforementioned"
4. Include specific details from the resume that directly relate to the job requirements
5. Keep paragraphs flowing naturally - no rigid structure that feels templated
6. Use contractions occasionally (I'm, I've, don't) to sound more natural
7. Show personality - the letter should feel like it was written by a real person, not generated
8. Keep it concise - 3-4 paragraphs maximum, around 250-350 words total
9. Do not start with "Dear Hiring Manager" if company name is provided - use something more specific
10. End with a warm, professional closing that doesn't feel generic

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

COMPANY NAME: {company_name}
JOB TITLE: {job_title}

Write the cover letter now. Remember: plain text only, sound human, be specific, show genuine interest."""

        try:
            response_text = llm_call(prompt, endpoint="/api/generate-cover-letter")

            # Clean up any potential markdown that slipped through
            cover_letter = response_text.strip()
            cover_letter = cover_letter.replace("**", "")
            cover_letter = cover_letter.replace("*", "")
            cover_letter = cover_letter.replace("###", "")
            cover_letter = cover_letter.replace("##", "")
            cover_letter = cover_letter.replace("#", "")
            cover_letter = cover_letter.replace("`", "")

            # Record usage after successful generation
            record_usage(
                g.user_id,
                "cover_letter",
                {"company": company_name, "job_title": job_title},
            )

            return jsonify(
                {"cover_letter": cover_letter, "word_count": len(cover_letter.split())}
            )

        except Exception as e:
            logger.error(f"Cover letter generation error: {e}")
            return jsonify({"error": "Failed to generate cover letter"}), 500

    # ---------------------------
    # BATCH MATCH FOR RECRUITERS
    # ---------------------------
    @app.route("/api/batch-match", methods=["POST"])
    @token_required
    def batch_match():
        """
        Process multiple resumes against a single job description.
        Premium feature for recruiters.
        """
        # Check if user is premium
        if g.user.get("subscription_type") != "premium":
            return jsonify(
                {
                    "error": "Batch matching is a premium feature. Please upgrade your subscription.",
                    "upgrade_required": True,
                }
            ), 403

        if not model:
            return jsonify({"error": "LLM not available"}), 500

        if "job_description" not in request.form:
            return jsonify({"error": "Missing job description"}), 400

        job_description = request.form["job_description"]

        if "resumes" not in request.files:
            return jsonify({"error": "No resume files provided"}), 400

        resume_files = request.files.getlist("resumes")

        if len(resume_files) > MAX_BATCH_RESUMES:
            return jsonify(
                {"error": f"Maximum {MAX_BATCH_RESUMES} resumes allowed per batch"}
            ), 400

        if len(resume_files) == 0:
            return jsonify({"error": "At least one resume file is required"}), 400

        results = []

        for resume_file in resume_files:
            filename = resume_file.filename

            try:
                resume_text = extract_text_from_pdf(resume_file.stream)

                if not resume_text:
                    results.append(
                        {
                            "filename": filename,
                            "error": "Could not extract text from PDF",
                        }
                    )
                    continue

                # Batch analysis prompt - more concise for efficiency
                prompt = f"""
                Analyze this resume against the job description. Return ONLY valid JSON.

                RESUME:
                {resume_text}

                JOB DESCRIPTION:
                {job_description}

                Return JSON with these exact keys:
                - "overall_match_score": integer 0-100
                - "keyword_match_score": integer 0-100
                - "skills_alignment_score": integer 0-100
                - "experience_relevance_score": integer 0-100
                - "formatting_structure_score": integer 0-100
                - "seniority_fit_score": integer 0-100
                - "matched_skills": array of 5-8 matched skill strings
                - "missing_skills": array of 5-8 missing skill strings
                - "candidate_name": extracted name from resume or "Unknown"
                - "years_experience": estimated years of relevant experience (integer)
                - "recommendation": "strongly_recommend", "recommend", "consider", or "not_recommended"
                - "summary": one sentence summary of the candidate's fit (max 50 words)
                """

                response_text = llm_call(prompt, endpoint="/api/batch-match")
                json_string = (
                    response_text.strip().replace("```json", "").replace("```", "")
                )

                # Parse JSON
                start = json_string.find("{")
                end = json_string.rfind("}") + 1
                json_string = json_string[start:end]

                analysis = json.loads(json_string)

                results.append(
                    {
                        "filename": filename,
                        "candidate_name": analysis.get("candidate_name", "Unknown"),
                        "scores": {
                            "overall_match_score": analysis.get(
                                "overall_match_score", 0
                            ),
                            "keyword_match_score": analysis.get(
                                "keyword_match_score", 0
                            ),
                            "skills_alignment_score": analysis.get(
                                "skills_alignment_score", 0
                            ),
                            "experience_relevance_score": analysis.get(
                                "experience_relevance_score", 0
                            ),
                            "formatting_structure_score": analysis.get(
                                "formatting_structure_score", 0
                            ),
                            "seniority_fit_score": analysis.get(
                                "seniority_fit_score", 0
                            ),
                        },
                        "matched_skills": analysis.get("matched_skills", []),
                        "missing_skills": analysis.get("missing_skills", []),
                        "years_experience": analysis.get("years_experience", 0),
                        "recommendation": analysis.get("recommendation", "consider"),
                        "summary": analysis.get("summary", ""),
                    }
                )

            except json.JSONDecodeError as e:
                logger.error(f"JSON parse error for {filename}: {e}")
                results.append(
                    {"filename": filename, "error": "Failed to parse analysis results"}
                )
            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")
                results.append({"filename": filename, "error": str(e)})

        # Record usage for batch analysis
        record_usage(g.user_id, "batch_analysis", {"count": len(resume_files)})

        # Sort results by overall score (highest first), errors at the end
        sorted_results = sorted(
            results,
            key=lambda x: x.get("scores", {}).get("overall_match_score", -1)
            if "error" not in x
            else -1,
            reverse=True,
        )

        return jsonify(
            {
                "results": sorted_results,
                "total_processed": len(results),
                "successful": len([r for r in results if "error" not in r]),
                "failed": len([r for r in results if "error" in r]),
            }
        )

    # ---------------------------
    # GENERATE RECRUITER REPORT
    # ---------------------------
    @app.route("/api/recruiter/report", methods=["POST"])
    @token_required
    def generate_recruiter_report():
        """
        Generate a detailed screening report with recommendations.
        """
        if g.user.get("subscription_type") != "premium":
            return jsonify(
                {
                    "error": "Report generation is a premium feature.",
                    "upgrade_required": True,
                }
            ), 403

        if not model:
            return jsonify({"error": "LLM not available"}), 500

        data = request.json

        if not data:
            return jsonify({"error": "No data provided"}), 400

        candidates = data.get("candidates", [])
        job_description = data.get("job_description", "")
        job_title = data.get("job_title", "the position")

        if not candidates or not job_description:
            return jsonify(
                {"error": "Candidates and job description are required"}
            ), 400

        # Build candidate summary for the report
        candidate_summaries = []
        for c in candidates:
            if "error" not in c:
                candidate_summaries.append(f"""
                - {c.get("candidate_name", c.get("filename", "Unknown"))}:
                  Overall Score: {c.get("scores", {}).get("overall_match_score", 0)}%
                  Skills Match: {c.get("scores", {}).get("skills_alignment_score", 0)}%
                  Experience: {c.get("years_experience", "N/A")} years
                  Matched Skills: {", ".join(c.get("matched_skills", [])[:5])}
                  Missing Skills: {", ".join(c.get("missing_skills", [])[:3])}
                """)

        prompt = f"""You are an experienced HR consultant. Generate a professional screening report for a recruiter.

JOB TITLE: {job_title}

JOB DESCRIPTION:
{job_description}

CANDIDATES ANALYZED:
{"".join(candidate_summaries)}

Generate a screening report in plain text (no markdown) with these sections:

1. EXECUTIVE SUMMARY
Brief overview of the candidate pool quality and key findings.

2. TOP CANDIDATES TO ADVANCE
List the top candidates (score 70%+) who should move to interview stage. For each, provide:
- Name and overall score
- Key strengths that match the role
- One area to probe in interview

3. CANDIDATES TO CONSIDER
List candidates scoring 50-69% who might be worth a second look. Briefly explain why.

4. NOT RECOMMENDED
List candidates below 50% with brief reasoning (without being harsh).

5. OVERALL RECOMMENDATIONS
- Suggested interview order
- Key skills to assess in interviews
- Any gaps in the candidate pool

Keep the tone professional but accessible. No bullet point symbols, use dashes instead.
Total length: 400-600 words."""

        try:
            response_text = llm_call(prompt, endpoint="/api/recruiter/report")

            # Clean up any markdown
            report = response_text.strip()
            report = report.replace("**", "")
            report = report.replace("*", "")
            report = report.replace("###", "")
            report = report.replace("##", "")
            report = report.replace("#", "")

            # Categorize candidates
            strongly_recommend = [
                c
                for c in candidates
                if "error" not in c and c.get("recommendation") == "strongly_recommend"
            ]
            recommend = [
                c
                for c in candidates
                if "error" not in c and c.get("recommendation") == "recommend"
            ]
            consider = [
                c
                for c in candidates
                if "error" not in c and c.get("recommendation") == "consider"
            ]
            not_recommended = [
                c
                for c in candidates
                if "error" not in c and c.get("recommendation") == "not_recommended"
            ]

            return jsonify(
                {
                    "report": report,
                    "summary": {
                        "total_candidates": len(candidates),
                        "strongly_recommend": len(strongly_recommend),
                        "recommend": len(recommend),
                        "consider": len(consider),
                        "not_recommended": len(not_recommended),
                    },
                    "candidates_by_category": {
                        "strongly_recommend": strongly_recommend,
                        "recommend": recommend,
                        "consider": consider,
                        "not_recommended": not_recommended,
                    },
                }
            )

        except Exception as e:
            logger.error(f"Report generation error: {e}")
            return jsonify({"error": "Failed to generate report"}), 500

    # ---------------------------
    # INTERVIEW PREPARATION ASSISTANT
    # ---------------------------
    @app.route("/api/interview-prep", methods=["POST"])
    @token_required
    def interview_prep():
        """
        Generate personalized interview preparation based on resume and job description.
        Deducts from user's daily usage limit.
        """
        # Check usage limit
        can_use, message = check_usage_limit(g.user_id, "interview_prep")
        if not can_use:
            return jsonify({"error": message, "upgrade_required": True}), 429

        if not model:
            return jsonify({"error": "LLM not available"}), 500

        data = request.json

        if not data:
            return jsonify({"error": "No data provided"}), 400

        resume_text = data.get("resume_text", "")
        job_description = data.get("job_description", "")
        job_title = data.get("job_title", "the position")
        company_name = data.get("company_name", "the company")
        analysis_results = data.get("analysis_results", {})

        if not resume_text or not job_description:
            return jsonify(
                {"error": "Resume text and job description are required"}
            ), 400

        # Extract key info from analysis if available
        missing_skills = analysis_results.get("missing_skills", [])
        matched_skills = analysis_results.get("matched_skills", [])
        weaknesses = analysis_results.get("keyword_gap_analysis", [])

        prompt = f"""You are an expert interview coach helping a candidate prepare for a job interview.

CANDIDATE'S RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

JOB TITLE: {job_title}
COMPANY: {company_name}

IDENTIFIED SKILL GAPS: {", ".join(missing_skills) if missing_skills else "None identified"}
MATCHED SKILLS: {", ".join(matched_skills) if matched_skills else "Not specified"}

Generate comprehensive interview preparation in the following JSON format. Return ONLY valid JSON, no markdown:

{{
    "likely_questions": [
        {{
            "category": "Technical" or "Behavioral" or "Situational" or "Role-Specific",
            "question": "The interview question",
            "why_asked": "Brief explanation of why interviewer asks this",
            "suggested_answer": "A suggested answer using the candidate's actual experience from their resume. Be specific and reference their background."
        }}
    ],
    "red_flags": [
        {{
            "concern": "What might concern the interviewer",
            "how_to_address": "How to proactively address or explain this"
        }}
    ],
    "questions_to_ask": [
        {{
            "question": "Smart question to ask the interviewer",
            "why_effective": "Why this question shows engagement/intelligence"
        }}
    ],
    "preparation_tips": [
        "Specific tip based on this role and candidate's background"
    ],
    "key_talking_points": [
        {{
            "topic": "Key strength or experience to highlight",
            "how_to_present": "How to effectively present this in the interview"
        }}
    ]
}}

Generate:
- 12-15 likely interview questions (mix of technical, behavioral, situational)
- 3-5 potential red flags based on resume gaps or concerns
- 5-7 smart questions for the candidate to ask
- 5-7 preparation tips
- 4-6 key talking points

Make answers specific to the candidate's actual resume content. Sound natural and human."""

        try:
            response_text = llm_call(prompt, endpoint="/api/interview-prep")

            # Parse JSON response
            json_string = (
                response_text.strip().replace("```json", "").replace("```", "")
            )
            start = json_string.find("{")
            end = json_string.rfind("}") + 1
            json_string = json_string[start:end]

            interview_prep_data = json.loads(json_string)

            # Record usage after successful generation
            record_usage(
                g.user_id,
                "interview_prep",
                {"job_title": job_title, "company": company_name},
            )

            return jsonify(
                {
                    "interview_prep": interview_prep_data,
                    "job_title": job_title,
                    "company_name": company_name,
                }
            )

        except json.JSONDecodeError as e:
            logger.error(f"Interview prep JSON parse error: {e}")
            return jsonify({"error": "Failed to parse interview preparation"}), 500
        except Exception as e:
            logger.error(f"Interview prep error: {e}")
            return jsonify({"error": "Failed to generate interview preparation"}), 500

    # ---------------------------
    # RECRUITER SCREENING SESSIONS - CRUD
    # ---------------------------

    @app.route("/api/recruiter/sessions", methods=["POST"])
    @token_required
    def create_screening_session():
        """Create a new screening session."""
        if g.user.get("subscription_type") != "premium":
            return jsonify(
                {
                    "error": "Screening sessions are a premium feature.",
                    "upgrade_required": True,
                }
            ), 403

        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        job_title = data.get("job_title", "Untitled Position")
        job_description = data.get("job_description", "")

        if not job_description:
            return jsonify({"error": "Job description is required"}), 400

        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                """
                INSERT INTO screening_sessions (user_id, job_title, job_description, total_candidates, results)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (g.user_id, job_title, job_description, 0, json.dumps([])),
            )

            result = cursor.fetchone()
            db.commit()

            return jsonify(
                {
                    "message": "Session created successfully",
                    "session": {
                        "id": result["id"],
                        "job_title": job_title,
                        "job_description": job_description,
                        "total_candidates": 0,
                        "results": [],
                        "created_at": result["created_at"].isoformat()
                        if result["created_at"]
                        else None,
                    },
                }
            ), 201

        except Exception as e:
            logger.error(f"Create session error: {e}")
            return jsonify({"error": "Failed to create session"}), 500

    @app.route("/api/recruiter/sessions", methods=["GET"])
    @token_required
    def get_screening_sessions():
        """Get all screening sessions for the current user."""
        if g.user.get("subscription_type") != "premium":
            return jsonify(
                {
                    "error": "Screening sessions are a premium feature.",
                    "upgrade_required": True,
                }
            ), 403

        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                """
                SELECT id, job_title, job_description, total_candidates, report, created_at
                FROM screening_sessions
                WHERE user_id = %s
                ORDER BY created_at DESC
                """,
                (g.user_id,),
            )

            sessions = cursor.fetchall()

            return jsonify(
                {
                    "sessions": [
                        {
                            "id": s["id"],
                            "job_title": s["job_title"],
                            "job_description": s["job_description"][:200] + "..."
                            if len(s["job_description"] or "") > 200
                            else s["job_description"],
                            "total_candidates": s["total_candidates"],
                            "has_report": bool(s["report"]),
                            "created_at": s["created_at"].isoformat()
                            if s["created_at"]
                            else None,
                        }
                        for s in sessions
                    ]
                }
            )

        except Exception as e:
            logger.error(f"Get sessions error: {e}")
            return jsonify({"error": "Failed to fetch sessions"}), 500

    @app.route("/api/recruiter/sessions/<int:session_id>", methods=["GET"])
    @token_required
    def get_screening_session(session_id):
        """Get a specific screening session with full results."""
        if g.user.get("subscription_type") != "premium":
            return jsonify(
                {
                    "error": "Screening sessions are a premium feature.",
                    "upgrade_required": True,
                }
            ), 403

        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                """
                SELECT id, job_title, job_description, total_candidates, results, report, created_at
                FROM screening_sessions
                WHERE id = %s AND user_id = %s
                """,
                (session_id, g.user_id),
            )

            session = cursor.fetchone()

            if not session:
                return jsonify({"error": "Session not found"}), 404

            # results is already deserialized by psycopg for JSONB columns
            results_data = session["results"] if session["results"] else []
            # Handle case where it might be a string (shouldn't happen but just in case)
            if isinstance(results_data, str):
                results_data = json.loads(results_data)

            return jsonify(
                {
                    "session": {
                        "id": session["id"],
                        "job_title": session["job_title"],
                        "job_description": session["job_description"],
                        "total_candidates": session["total_candidates"],
                        "results": results_data,
                        "report": session["report"],
                        "created_at": session["created_at"].isoformat()
                        if session["created_at"]
                        else None,
                    }
                }
            )

        except Exception as e:
            logger.error(f"Get session error: {e}")
            return jsonify({"error": "Failed to fetch session"}), 500

    @app.route("/api/recruiter/sessions/<int:session_id>", methods=["DELETE"])
    @token_required
    def delete_screening_session(session_id):
        """Delete a screening session."""
        if g.user.get("subscription_type") != "premium":
            return jsonify(
                {
                    "error": "Screening sessions are a premium feature.",
                    "upgrade_required": True,
                }
            ), 403

        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                "DELETE FROM screening_sessions WHERE id = %s AND user_id = %s RETURNING id",
                (session_id, g.user_id),
            )

            deleted = cursor.fetchone()
            db.commit()

            if not deleted:
                return jsonify({"error": "Session not found"}), 404

            return jsonify({"message": "Session deleted successfully"})

        except Exception as e:
            logger.error(f"Delete session error: {e}")
            return jsonify({"error": "Failed to delete session"}), 500

    @app.route("/api/recruiter/sessions/<int:session_id>/analyze", methods=["POST"])
    @token_required
    def add_candidates_to_session(session_id):
        """Add and analyze more candidates to an existing session."""
        if g.user.get("subscription_type") != "premium":
            return jsonify(
                {
                    "error": "Screening sessions are a premium feature.",
                    "upgrade_required": True,
                }
            ), 403

        if not model:
            return jsonify({"error": "LLM not available"}), 500

        # Get the session first
        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                "SELECT * FROM screening_sessions WHERE id = %s AND user_id = %s",
                (session_id, g.user_id),
            )
            session = cursor.fetchone()

            if not session:
                return jsonify({"error": "Session not found"}), 404

        except Exception as e:
            logger.error(f"Session fetch error: {e}")
            return jsonify({"error": "Failed to fetch session"}), 500

        job_description = session["job_description"]

        if "resumes" not in request.files:
            return jsonify({"error": "No resume files provided"}), 400

        resume_files = request.files.getlist("resumes")

        if len(resume_files) > MAX_BATCH_RESUMES:
            return jsonify(
                {"error": f"Maximum {MAX_BATCH_RESUMES} resumes allowed per batch"}
            ), 400

        if len(resume_files) == 0:
            return jsonify({"error": "At least one resume file is required"}), 400

        # Get existing results - results is already deserialized by psycopg for JSONB
        existing_results = session["results"] if session["results"] else []
        if isinstance(existing_results, str):
            existing_results = json.loads(existing_results)
        new_results = []

        for resume_file in resume_files:
            filename = resume_file.filename

            try:
                resume_text = extract_text_from_pdf(resume_file.stream)

                if not resume_text:
                    new_results.append(
                        {
                            "filename": filename,
                            "error": "Could not extract text from PDF",
                        }
                    )
                    continue

                prompt = f"""
                Analyze this resume against the job description. Return ONLY valid JSON.

                RESUME:
                {resume_text}

                JOB DESCRIPTION:
                {job_description}

                Return JSON with these exact keys:
                - "overall_match_score": integer 0-100
                - "keyword_match_score": integer 0-100
                - "skills_alignment_score": integer 0-100
                - "experience_relevance_score": integer 0-100
                - "formatting_structure_score": integer 0-100
                - "seniority_fit_score": integer 0-100
                - "matched_skills": array of 5-8 matched skill strings
                - "missing_skills": array of 5-8 missing skill strings
                - "candidate_name": extracted name from resume or "Unknown"
                - "years_experience": estimated years of relevant experience (integer)
                - "recommendation": "strongly_recommend", "recommend", "consider", or "not_recommended"
                - "summary": one sentence summary of the candidate's fit (max 50 words)
                """

                response_text = llm_call(
                    prompt, endpoint="/api/recruiter/sessions/analyze"
                )
                json_string = (
                    response_text.strip().replace("```json", "").replace("```", "")
                )

                start = json_string.find("{")
                end = json_string.rfind("}") + 1
                json_string = json_string[start:end]

                analysis = json.loads(json_string)

                new_results.append(
                    {
                        "filename": filename,
                        "candidate_name": analysis.get("candidate_name", "Unknown"),
                        "scores": {
                            "overall_match_score": analysis.get(
                                "overall_match_score", 0
                            ),
                            "keyword_match_score": analysis.get(
                                "keyword_match_score", 0
                            ),
                            "skills_alignment_score": analysis.get(
                                "skills_alignment_score", 0
                            ),
                            "experience_relevance_score": analysis.get(
                                "experience_relevance_score", 0
                            ),
                            "formatting_structure_score": analysis.get(
                                "formatting_structure_score", 0
                            ),
                            "seniority_fit_score": analysis.get(
                                "seniority_fit_score", 0
                            ),
                        },
                        "matched_skills": analysis.get("matched_skills", []),
                        "missing_skills": analysis.get("missing_skills", []),
                        "years_experience": analysis.get("years_experience", 0),
                        "recommendation": analysis.get("recommendation", "consider"),
                        "summary": analysis.get("summary", ""),
                    }
                )

            except json.JSONDecodeError as e:
                logger.error(f"JSON parse error for {filename}: {e}")
                new_results.append(
                    {"filename": filename, "error": "Failed to parse analysis results"}
                )
            except Exception as e:
                logger.error(f"Error processing {filename}: {e}")
                new_results.append({"filename": filename, "error": str(e)})

        # Combine results
        all_results = existing_results + new_results
        total_candidates = len([r for r in all_results if "error" not in r])

        # Update session in database
        try:
            cursor.execute(
                """
                UPDATE screening_sessions
                SET results = %s, total_candidates = %s
                WHERE id = %s AND user_id = %s
                """,
                (json.dumps(all_results), total_candidates, session_id, g.user_id),
            )
            db.commit()

        except Exception as e:
            logger.error(f"Session update error: {e}")
            return jsonify({"error": "Failed to update session"}), 500

        # Record usage
        record_usage(
            g.user_id,
            "batch_analysis",
            {"count": len(resume_files), "session_id": session_id},
        )

        # Sort results by overall score
        sorted_results = sorted(
            all_results,
            key=lambda x: x.get("scores", {}).get("overall_match_score", -1)
            if "error" not in x
            else -1,
            reverse=True,
        )

        return jsonify(
            {
                "results": sorted_results,
                "new_candidates": len(new_results),
                "total_candidates": total_candidates,
                "session_id": session_id,
            }
        )

    @app.route("/api/recruiter/sessions/<int:session_id>/report", methods=["POST"])
    @token_required
    def save_session_report(session_id):
        """Save a generated report to the session."""
        if g.user.get("subscription_type") != "premium":
            return jsonify(
                {
                    "error": "Screening sessions are a premium feature.",
                    "upgrade_required": True,
                }
            ), 403

        data = request.json
        if not data or not data.get("report"):
            return jsonify({"error": "Report content is required"}), 400

        try:
            db = get_db()
            cursor = db.cursor()

            cursor.execute(
                """
                UPDATE screening_sessions
                SET report = %s
                WHERE id = %s AND user_id = %s
                RETURNING id
                """,
                (data["report"], session_id, g.user_id),
            )

            updated = cursor.fetchone()
            db.commit()

            if not updated:
                return jsonify({"error": "Session not found"}), 404

            return jsonify({"message": "Report saved successfully"})

        except Exception as e:
            logger.error(f"Save report error: {e}")
            return jsonify({"error": "Failed to save report"}), 500
