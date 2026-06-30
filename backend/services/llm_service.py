"""
Shared LLM service for ATS Matcher Backend.

Centralizes LLM client initialization, LLM call wrapper, and token usage recording
so multiple route modules can reuse the same logic without circular imports.
"""

import os
import time
from dotenv import load_dotenv
from flask import g
from openai import OpenAI
from db.database import get_db
from logger.app_logger import logger, log_llm_call

load_dotenv()

MODEL = "openai/gpt-oss-120b"

# OpenRouter pricing for openai/gpt-oss-120b (per 1M tokens)
# Prompt: $0.15, Completion: $0.60
COST_PER_1K_PROMPT = 0.00015      # $0.15 / 1000
COST_PER_1K_COMPLETION = 0.0006   # $0.60 / 1000

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


def llm_call(prompt, endpoint="unknown"):
    """Make an LLM call with usage tracking and logging."""
    if not model:
        logger.error(f"LLM call failed for {endpoint}: model not initialized")
        raise RuntimeError("LLM model not initialized")

    start_time = time.time()
    logger.info(f"LLM call started: {endpoint}")

    try:
        response = model.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=MODEL,
            timeout=70,
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
    """Record token usage to the database with accurate OpenRouter pricing."""
    estimated_cost = (prompt_tokens / 1000 * COST_PER_1K_PROMPT) + (
        completion_tokens / 1000 * COST_PER_1K_COMPLETION
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
