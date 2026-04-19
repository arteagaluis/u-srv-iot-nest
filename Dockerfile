# =============================================================================
# Stage 1: Build
# =============================================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code and config files
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production

# =============================================================================
# Stage 2: Production
# =============================================================================
FROM node:24-alpine AS production

# Add labels for container metadata
LABEL maintainer="luis"
LABEL app="u-srv-iot"
LABEL description="Teliot IoT Auth Microservice"

# Set NODE_ENV
ENV NODE_ENV=production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nestjs && \
    adduser -S nestjs -u 1001

# Copy only production artifacts from builder
COPY --from=builder --chown=nestjs:nestjs /app/dist ./dist
COPY --from=builder --chown=nestjs:nestjs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nestjs /app/package.json ./package.json

# Switch to non-root user
USER nestjs

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]
