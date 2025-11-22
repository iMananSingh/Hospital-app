# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine AS builder

# Install build dependencies needed for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy application code
COPY . .

# Build the application (frontend + backend)
RUN npm run build

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create directory for SQLite database with proper permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

# Use non-root user for security
USER node

# Expose port (Fly.io uses 8080)
EXPOSE 8080

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]
