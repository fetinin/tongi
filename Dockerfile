# Multi-stage build for production Next.js app with pnpm

# Stage 1: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including native modules like better-sqlite3)
RUN pnpm install --frozen-lockfile

# Rebuild native modules to ensure they're compiled for container architecture
RUN pnpm rebuild better-sqlite3

# Copy source code
COPY . .

# Skip database initialization during build (Next.js static analysis)
ENV SKIP_DB_INIT=true

# Build the application
RUN pnpm run build

# Stage 2: Runner (production)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy database migration scripts and schema
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/lib/database ./src/lib/database

# Create data directory for SQLite with proper permissions
RUN mkdir -p ./data && chown nextjs:nodejs ./data

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set port environment variable
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
