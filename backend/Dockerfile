FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (tsx is needed at runtime)
RUN npm ci

# Copy source
COPY . .

# Don't copy local data or env files
# (these are in .dockerignore)

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3000/v1/health || exit 1

# Start
CMD ["npx", "tsx", "src/server.ts"]
