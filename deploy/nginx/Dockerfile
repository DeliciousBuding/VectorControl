FROM nginx:1.27-alpine

# Install brotli module for better compression
RUN apk add --no-cache nginx-mod-http-brotli

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf
COPY site.conf /etc/nginx/conf.d/default.conf
