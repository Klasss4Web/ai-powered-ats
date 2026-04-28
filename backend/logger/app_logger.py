import logging
import os


# --- Color Formatter ---
class ColorFormatter(logging.Formatter):
    COLORS = {
        'DEBUG': '\033[94m',    # Blue
        'INFO': '\033[92m',     # Green
        'WARNING': '\033[93m',  # Yellow
        'ERROR': '\033[91m',    # Red
        'CRITICAL': '\033[95m', # Magenta
    }
    RESET = '\033[0m'

    def format(self, record):
        color = self.COLORS.get(record.levelname, self.RESET)
        message = super().format(record)
        return f"{color}{message}{self.RESET}"

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

logger = logging.getLogger("ats-matcher")
if not logger.hasHandlers():
    handler = logging.StreamHandler()
    handler.setFormatter(ColorFormatter(LOG_FORMAT))
    logger.addHandler(handler)
logger.setLevel(LOG_LEVEL)
