# ─────────────────────────────────────────────────────────────────────────────
# Terroir.ma — Multi-stage Dockerfile
# Stage 1 (builder): compiles TypeScript to dist/
# Stage 2 (runner):  production image with non-root user
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:26-alpine AS builder

WORKDIR /app

# Copy manifests first to exploit layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy source code
COPY . .

# Compile TypeScript
RUN npm run build

# ── Stage 2: Production Runner ───────────────────────────────────────────────
FROM node:26-alpine AS runner

# Create non-root system group and user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy manifests for production install
COPY package*.json ./

# Install only production dependencies (--ignore-scripts prevents husky
# prepare hook from running when devDependencies are absent)
RUN npm ci --omit=dev --ignore-scripts

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy shared module (runtime schemas, enums, types)
COPY --from=builder /app/shared ./shared

# Copy font assets for PDF certificate generation
# (TTF files are gitignored — downloaded at build time via fonts:download)
COPY --from=builder /app/assets ./assets

# Drop to non-root user
USER appuser

EXPOSE 3000

# Container-native health check (matches compose health check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
