FROM python:3.11-slim

WORKDIR /app

# Copy EVERYTHING from backend INTO container root
COPY backend/ /app/

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

EXPOSE 5000

# Increase timeout to 120s so long AI calls (OpenRouter) aren't killed by gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:5000", "--timeout", "120", "app:app"]
# CMD ["python", "app.py"]