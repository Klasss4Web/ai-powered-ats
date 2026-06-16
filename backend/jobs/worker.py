"""
Background job worker for ATS Matcher.
Uses ThreadPoolExecutor to process long-running jobs asynchronously.
"""

import concurrent.futures
import datetime
import json
import os
import tempfile
import time
import traceback
from io import BytesIO

import psycopg
from psycopg.rows import dict_row

from config import DATABASE_URL, MAX_BATCH_RESUMES
from logger.app_logger import logger

# Thread pool for background workers
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
_running = True

MODEL = "openai/gpt-oss-120b"


def _get_db_conn():
    """Standalone DB connection for worker threads (no Flask g)."""
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def _update_job(job_id, status=None, progress=None, total=None,
                result=None, error_message=None):
    """Atomic job status update."""
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                fields = []
                vals = []
                if status:
                    fields.append("status = %s")
                    vals.append(status)
                if progress is not None:
                    fields.append("progress = %s")
                    vals.append(progress)
                if total is not None:
                    fields.append("total = %s")
                    vals.append(total)
                if result is not None:
                    fields.append("result = %s")
                    vals.append(json.dumps(result))
                if error_message is not None:
                    fields.append("error_message = %s")
                    vals.append(error_message)

                fields.append("updated_at = %s")
                vals.append(datetime.datetime.utcnow())

                if status in ("completed", "failed"):
                    fields.append("completed_at = %s")
                    vals.append(datetime.datetime.utcnow())

                vals.append(job_id)
                cur.execute(
                    f"UPDATE jobs SET {', '.join(fields)} WHERE id = %s",
                    vals,
                )
                conn.commit()
    except Exception as e:
        logger.error(f"Job update failed for job {job_id}: {e}")


def _extract_text_from_pdf(file_stream):
    """Re-import to avoid circular deps."""
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(file_stream)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception:
        return ""


def _llm_call(prompt, endpoint="/api/batch-match"):
    """Re-import LLM call logic."""
    try:
        from routes.resume import llm_call as _llm
        return _llm_call_with_openai(prompt)
    except Exception:
        # Fallback: try to use whatever LLM is available
        logger.error("LLM not available for background job")
        return None
    


def _llm_call_with_openai(prompt):
    """Direct OpenAI call for background worker."""
    try:
        from openai import OpenAI
        import os
        # client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.getenv("OPENROUTER_API_KEY"))
        resp = client.chat.completions.create(
            # model="gpt-4o-mini",
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        return resp.choices[0].message.content
    except Exception:
        return None


def _process_batch_match(job_id, payload):
    """
    Process a batch-match job.
    Payload: {
        job_description: str,
        temp_dir: str,        -- directory containing uploaded PDFs
        session_id: int|null  -- existing session to append to
    }
    """
    import glob

    job_desc = payload.get("job_description", "")
    temp_dir = payload.get("temp_dir", "")
    user_id = payload.get("user_id")
    target_session_id = payload.get("session_id")

    pdf_files = sorted(glob.glob(os.path.join(temp_dir, "*.pdf")))
    total = len(pdf_files)
    _update_job(job_id, status="running", progress=0, total=total)

    results = []
    for idx, pdf_path in enumerate(pdf_files):
        filename = os.path.basename(pdf_path)
        try:
            with open(pdf_path, "rb") as f:
                resume_text = _extract_text_from_pdf(BytesIO(f.read()))

            if not resume_text:
                results.append({"filename": filename, "error": "Could not extract text from PDF"})
                continue

            prompt = f"""
Analyze this resume against the job description. Return ONLY valid JSON.

<resume_text>
{resume_text}
</resume_text>

<job_description_text>
{job_desc}
</job_description_text>

Return JSON with these exact keys:
- "overall_match_score": integer 0-100
- "keyword_match_score": integer 0-100
- "skills_alignment_score": integer 0-100
- "experience_relevance_score": integer 0-100
- "formatting_structure_score": integer 0-100
- "seniority_fit_score": integer 0-100
- "matched_skills": array of 5-8 matched skill strings
- "missing_skills": array of 5-8 missing skill strings
- "candidate_name": full name extracted from resume, or "Unknown"
- "candidate_email": email address extracted from resume, or "" if not found
- "years_experience": estimated years of relevant experience (integer)
- "recommendation": "strongly_recommend", "recommend", "consider", or "not_recommended"
- "summary": one sentence summary of the candidate's fit (max 50 words)
"""

            response_text = _llm_call_with_openai(prompt)
            if not response_text:
                results.append({"filename": filename, "error": "LLM unavailable"})
                continue

            json_string = response_text.strip().replace("```json", "").replace("```", "")
            start = json_string.find("{")
            end = json_string.rfind("}") + 1
            json_string = json_string[start:end]
            analysis = json.loads(json_string)

            results.append({
                "filename": filename,
                "candidate_name": analysis.get("candidate_name", "Unknown"),
                "candidate_email": analysis.get("candidate_email", ""),
                "scores": {
                    "overall_match_score": analysis.get("overall_match_score", 0),
                    "keyword_match_score": analysis.get("keyword_match_score", 0),
                    "skills_alignment_score": analysis.get("skills_alignment_score", 0),
                    "experience_relevance_score": analysis.get("experience_relevance_score", 0),
                    "formatting_structure_score": analysis.get("formatting_structure_score", 0),
                    "seniority_fit_score": analysis.get("seniority_fit_score", 0),
                },
                "matched_skills": analysis.get("matched_skills", []),
                "missing_skills": analysis.get("missing_skills", []),
                "years_experience": analysis.get("years_experience", 0),
                "recommendation": analysis.get("recommendation", "consider"),
                "summary": analysis.get("summary", ""),
            })
        except Exception as e:
            logger.error(f"Error processing {filename} in job {job_id}: {e}")
            results.append({"filename": filename, "error": str(e)})

        _update_job(job_id, progress=idx + 1)

    # Save results to session or create new session
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                if target_session_id:
                    # Append to existing session
                    cur.execute(
                        "SELECT results FROM screening_sessions WHERE id = %s AND user_id = %s",
                        (target_session_id, user_id),
                    )
                    row = cur.fetchone()
                    existing = row["results"] or []
                    all_results = existing + results
                    successful = len([r for r in all_results if "error" not in r])
                    cur.execute(
                        """UPDATE screening_sessions
                           SET results = %s, total_candidates = %s
                           WHERE id = %s AND user_id = %s""",
                        (json.dumps(all_results), successful, target_session_id, user_id),
                    )
                    session_id = target_session_id
                else:
                    # Create new session
                    successful = len([r for r in results if "error" not in r])
                    cur.execute(
                        """INSERT INTO screening_sessions
                           (user_id, job_title, job_description, total_candidates, results)
                           VALUES (%s, %s, %s, %s, %s)
                           RETURNING id""",
                        (user_id, "Untitled Position", job_desc, successful, json.dumps(results)),
                    )
                    session_id = cur.fetchone()["id"]
                conn.commit()

        _update_job(
            job_id,
            status="completed",
            result={
                "results": results,
                "total_processed": len(results),
                "successful": len([r for r in results if "error" not in r]),
                "failed": len([r for r in results if "error" in r]),
                "session_id": session_id,
            },
        )
    except Exception as e:
        logger.error(f"Failed to save batch results for job {job_id}: {e}")
        _update_job(job_id, status="failed", error_message=str(e))
    finally:
        # Clean up temp files
        try:
            for f in pdf_files:
                os.remove(f)
            os.rmdir(temp_dir)
        except Exception:
            pass


def _run_job(job_id, job_type, payload, user_id):
    """Route job to appropriate handler."""
    try:
        payload["user_id"] = user_id
        if job_type == "batch_match":
            _process_batch_match(job_id, payload)
        else:
            _update_job(job_id, status="failed", error_message=f"Unknown job type: {job_type}")
    except Exception as e:
        logger.error(f"Job {job_id} crashed: {e}\n{traceback.format_exc()}")
        _update_job(job_id, status="failed", error_message=str(e))


def submit_job(user_id, job_type, payload):
    """
    Submit a new background job.
    Returns the created job_id.
    """
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO jobs (user_id, job_type, status, payload)
                       VALUES (%s, %s, 'pending', %s)
                       RETURNING id""",
                    (user_id, job_type, json.dumps(payload)),
                )
                job_id = cur.fetchone()["id"]
                conn.commit()

        # Queue the job
        _executor.submit(_worker_loop_once, job_id)
        return job_id
    except Exception as e:
        logger.error(f"Failed to submit job: {e}")
        raise


def _worker_loop_once(job_id):
    """Pick up a specific job and process it."""
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE jobs SET status = 'running', updated_at = %s WHERE id = %s RETURNING job_type, payload, user_id",
                    (datetime.datetime.utcnow(), job_id),
                )
                row = cur.fetchone()
                conn.commit()
                if not row:
                    return
                _run_job(job_id, row["job_type"], row["payload"], row["user_id"])
    except Exception as e:
        logger.error(f"Worker crash for job {job_id}: {e}")
        _update_job(job_id, status="failed", error_message=str(e))


def get_job_status(job_id, user_id):
    """Return job state for polling."""
    try:
        with _get_db_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, status, progress, total, result, error_message,
                              created_at, updated_at, completed_at
                       FROM jobs WHERE id = %s AND user_id = %s""",
                    (job_id, user_id),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {
                    "id": row["id"],
                    "status": row["status"],
                    "progress": row["progress"],
                    "total": row["total"],
                    "result": row["result"],
                    "error_message": row["error_message"],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                    "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
                    "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
                }
    except Exception as e:
        logger.error(f"Failed to get job status: {e}")
        return None


def shutdown():
    """Graceful shutdown."""
    global _running
    _running = False
    _executor.shutdown(wait=True)
