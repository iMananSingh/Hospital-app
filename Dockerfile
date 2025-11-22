# Use official Node.js LTS image
FROM node:20-alpine AS base

# Install necessary build tools for native dependencies (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies for SQLite
RUN apk add --no-cache sqlite

WORKDIR /app

# Copy package files and install all dependencies
# (vite is needed by the server code even in production)
COPY package*.json ./
RUN npm ci

# Copy built application from build stage
COPY --from=base /app/dist ./dist
COPY --from=base /app/client ./client

# Create data directory for volume mount
RUN mkdir -p /data && chmod 777 /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV DATABASE_PATH=/data/hospital.db

# Expose port
EXPOSE 8080

# Start the application
# Run with error output to help debug any startup issues
CMD ["node", "--expose-gc", "dist/index.js"]
