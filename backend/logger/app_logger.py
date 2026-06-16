import logging
import os
import json
from datetime import datetime
from functools import wraps
from flask import request, g

from dotenv import load_dotenv

load_dotenv()


# --- Color Formatter ---
class ColorFormatter(logging.Formatter):
    COLORS = {
        "DEBUG": "\033[94m",  # Blue
        "INFO": "\033[92m",  # Green
        "WARNING": "\033[93m",  # Yellow
        "ERROR": "\033[91m",  # Red
        "CRITICAL": "\033[95m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        message = super().format(record)
        return f"{color}{message}{self.RESET}"


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

# Main application logger
logger = logging.getLogger("ats-matcher")
if not logger.hasHandlers():
    handler = logging.StreamHandler()
    handler.setFormatter(ColorFormatter(LOG_FORMAT))
    logger.addHandler(handler)
logger.setLevel(LOG_LEVEL)

# Specialized loggers
api_logger = logging.getLogger("ats-matcher.api")
auth_logger = logging.getLogger("ats-matcher.auth")
db_logger = logging.getLogger("ats-matcher.db")
llm_logger = logging.getLogger("ats-matcher.llm")
payment_logger = logging.getLogger("ats-matcher.payment")


def log_request(func):
    """Decorator to log API requests and responses."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        # Log request
        user_id = getattr(g, "user_id", "anonymous")
        api_logger.info(
            f"REQUEST: {request.method} {request.path} | "
            f"User: {user_id} | "
            f"IP: {request.remote_addr}"
        )

        try:
            response = func(*args, **kwargs)

            # Log response status
            status_code = response[1] if isinstance(response, tuple) else 200
            api_logger.info(
                f"RESPONSE: {request.method} {request.path} | "
                f"Status: {status_code} | "
                f"User: {user_id}"
            )

            return response
        except Exception as e:
            api_logger.error(
                f"ERROR: {request.method} {request.path} | "
                f"User: {user_id} | "
                f"Error: {str(e)}"
            )
            raise

    return wrapper


def log_auth_event(
    event_type, user_email=None, user_id=None, success=True, details=None
):
    """Log authentication events."""
    log_data = {
        "event": event_type,
        "email": user_email,
        "user_id": user_id,
        "success": success,
        "ip": request.remote_addr if request else None,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if details:
        log_data["details"] = details

    if success:
        auth_logger.info(
            f"AUTH: {event_type} | Email: {user_email} | Success: {success}"
        )
    else:
        auth_logger.warning(
            f"AUTH: {event_type} | Email: {user_email} | Success: {success} | Details: {details}"
        )


def log_db_operation(operation, table, success=True, details=None, duration_ms=None):
    """Log database operations."""
    msg = f"DB: {operation} on {table} | Success: {success}"
    if duration_ms:
        msg += f" | Duration: {duration_ms}ms"
    if details:
        msg += f" | Details: {details}"

    if success:
        db_logger.debug(msg)
    else:
        db_logger.error(msg)


def log_llm_call(
    endpoint,
    model,
    prompt_tokens=None,
    completion_tokens=None,
    total_tokens=None,
    duration_ms=None,
    success=True,
    error=None,
):
    """Log LLM API calls."""
    msg = f"LLM: {endpoint} | Model: {model} | Success: {success}"
    if prompt_tokens:
        msg += f" | Prompt: {prompt_tokens} tokens"
    if completion_tokens:
        msg += f" | Completion: {completion_tokens} tokens"
    if total_tokens:
        msg += f" | Total: {total_tokens} tokens"
    if duration_ms:
        msg += f" | Duration: {duration_ms}ms"
    if error:
        msg += f" | Error: {error}"

    if success:
        llm_logger.info(msg)
    else:
        llm_logger.error(msg)


def log_payment_event(
    event_type,
    user_id=None,
    amount=None,
    currency=None,
    reference=None,
    gateway=None,
    success=True,
    details=None,
):
    """Log payment events."""
    msg = f"PAYMENT: {event_type} | Gateway: {gateway} | User: {user_id}"
    if amount:
        msg += f" | Amount: {amount} {currency or ''}"
    if reference:
        msg += f" | Ref: {reference}"
    msg += f" | Success: {success}"
    if details:
        msg += f" | Details: {details}"

    if success:
        payment_logger.info(msg)
    else:
        payment_logger.error(msg)
