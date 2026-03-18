# Build Stage
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 (native modules)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package management files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the frontend artifacts into /app/dist
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-slim AS runner

WORKDIR /app

# Install runtime dependencies for better-sqlite3 (if any native linkage remains)
# Node 22 slim should handle most but we add these just in case for rebuilds
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy only the built dist and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data && chmod 777 /app/data

# Environment Variables
ENV NODE_ENV=production
ENV PORT=3000
# Tell the app to use the data directory if we modify it
ENV SQLITE_DB_PATH=/app/data/survey.db

EXPOSE 3000

# Start directly using tsx since it's already in the node_modules
# This allows running server.ts without manual transpilation but still being production fast
CMD ["npx", "tsx", "server.ts"]
