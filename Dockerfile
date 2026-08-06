# LiveStream Hub - Multi-stage production Dockerfile
# Stage 1: Build frontend
FROM node:20-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:20-bookworm-slim AS backend-builder
WORKDIR /app/backend
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ libsqlite3-dev && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY backend/ ./
RUN npm run build

# Stage 3: Production runtime with FFmpeg
FROM node:20-bookworm-slim AS production
WORKDIR /app

# Install FFmpeg (includes x264, vaapi, nvenc via driver mount)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsqlite3-0 \
    tini \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built backend
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package.json ./backend/package.json

# Copy built frontend static export
COPY --from=frontend-builder /app/frontend/out ./frontend/out

# Storage directories
RUN mkdir -p /app/storage/{videos,thumbnails,hls,backups,logs,uploads}

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV STORAGE_DIR=/app/storage
ENV VIDEOS_DIR=/app/storage/videos
ENV THUMBNAILS_DIR=/app/storage/thumbnails
ENV HLS_DIR=/app/storage/hls
ENV BACKUPS_DIR=/app/storage/backups
ENV LOGS_DIR=/app/storage/logs
ENV UPLOADS_DIR=/app/storage/uploads
ENV SQLITE_PATH=/app/storage/livestream-hub.db
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8080/api/health || exit 1

# Use tini for proper signal handling (FFmpeg process cleanup)
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
