# --- Stage 1: Frontend Builder ---
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ .
RUN npm run build


# --- Stage 2: Backend Builder ---
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim AS backend-builder

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_HTTP_TIMEOUT=1000

COPY uv.lock pyproject.toml ./

RUN uv sync --no-install-project --no-dev

COPY . .

RUN uv sync --no-dev


# --- Stage 3: Final Runtime ---
FROM python:3.11-slim-bookworm

# Install nginx
RUN apt-get update && \
    apt-get install -y nginx && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend
COPY --from=backend-builder /app /app

ENV PATH="/app/.venv/bin:$PATH"

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Copy nginx config
COPY nginx/default.conf /etc/nginx/sites-available/default

RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Startup script
RUN echo '#!/bin/bash\n\
    nginx &\n\
    python outbound/server.py &\n\
    uvicorn outbound.make_call:app --host 0.0.0.0 --port 8000\n\
    ' > /app/start-app.sh && chmod +x /app/start-app.sh

EXPOSE 8000

CMD ["/app/start-app.sh"]