FROM python:3.11-slim

WORKDIR /app

# install dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# install gunicorn explicitly (safe fallback)
RUN pip install gunicorn

# copy backend code into container root
COPY backend/ .

EXPOSE 5000

# IMPORTANT: app.py is now in /app/app.py
CMD ["gunicorn", "-b", "0.0.0.0:5000", "app:app"]