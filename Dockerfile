# syntax=docker/dockerfile:1.7

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps from lockfile for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy source and build production bundle
COPY . .
RUN npm run build:prod

# ---------- Stage 2: Runtime ----------
FROM nginx:1.27-alpine AS runtime

# Replace default Nginx site with our SPA config (static port 8080)
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets produced by @angular/build:application
COPY --from=builder /app/dist/tubus-express/browser /usr/share/nginx/html

# Railway injects PORT dynamically; expose for clarity only
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
