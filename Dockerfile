# --- Stage 1: Frontend Builder ---
FROM node:20-slim AS frontend-builder

# Declare build-time args for Vite (must be set with --build-arg or in docker-compose)
ARG VITE_COGNITO_USER_POOL_ID
ARG VITE_COGNITO_APP_CLIENT_ID

# Expose them as ENV so Vite picks them up during build
ENV VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID
ENV VITE_COGNITO_APP_CLIENT_ID=$VITE_COGNITO_APP_CLIENT_ID

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
    nginx\n\
    python outbound/server.py &\n\
    uvicorn inbound.main:app --host 127.0.0.1 --port 5000\n\
    ' > /app/start-app.sh && chmod +x /app/start-app.sh

EXPOSE 4000

CMD ["/app/start-app.sh"]