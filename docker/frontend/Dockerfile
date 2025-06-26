FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm install --silent

# Copy frontend source code
COPY frontend/ ./

# Build for production
RUN npm run build

# Use a lightweight server for production
FROM nginx:alpine

# Create directory for SSL certificates
RUN mkdir -p /etc/nginx/ssl

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration if needed
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Note: SSL certificates will be mounted as volume from backend during runtime

# Expose port
EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"] 