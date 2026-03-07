FROM nginx:1.27-alpine

# Install brotli module for better compression
RUN apk add --no-cache nginx-mod-http-brotli

# Copy nginx configuration
COPY deploy/nginx/nginx.conf /etc/nginx/nginx.conf
COPY deploy/nginx/site.http.conf /etc/nginx/conf.d/default.conf
