# Multi-stage build for production Next.js app with pnpm

# Stage 1: Builder
FROM node:24-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Fix sqlite3: https://github.com/WiseLibs/better-sqlite3/issues/1378#issuecomment-2974070269
RUN printf "onlyBuiltDependencies:\n- better-sqlite3\n" >> pnpm-workspace.yaml

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install dependencies (including native modules like better-sqlite3)
RUN pnpm install --frozen-lockfile

# Rebuild native modules to ensure they're compiled for container architecture
RUN pnpm rebuild better-sqlite3

# Copy source code
COPY . .

# Build the application
RUN SKIP_DB_INIT=true pnpm run build

# Stage 2: Runner (production)
FROM builder AS runner
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
