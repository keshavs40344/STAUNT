FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5000 \
    FLASK_ENV=production

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy repository source
COPY . .

# Expose web port
EXPOSE 5000

# Start production server
CMD ["sh", "-c", "gunicorn --chdir search-engine wsgi:app --bind 0.0.0.0:${PORT:-5000} --workers 2 --threads 4 --timeout 120 --log-level info"]
