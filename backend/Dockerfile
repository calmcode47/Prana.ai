# ==============================================================================
# PRANA Backend — Production Dockerfile
# Multi-stage / lightweight container for FastAPI, PostGIS client, and ML models
# ==============================================================================
FROM python:3.12-slim AS base

# Install curl for container health check and system libraries for image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create unprivileged application user
RUN addgroup --system prana && adduser --system --ingroup prana prana

# Copy requirements and install dependencies
COPY backend/requirements.lock.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source and synthetic corridor data
COPY backend/ /app/backend/

# Environment configurations
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    PORT=8000 \
    HOST=0.0.0.0

# Set ownership to unprivileged user
RUN chown -R prana:prana /app

USER prana

EXPOSE 8000

# Container Healthcheck (SEC-001)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/ready || exit 1

# Production server entrypoint
CMD ["python", "-m", "backend.scripts.serve"]
