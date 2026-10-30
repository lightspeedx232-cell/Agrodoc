# Build the Vite app, then serve the static bundle with nginx.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
# Set the public backend URL at build time (edit as needed for your domain).
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine AS serve
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback so client-side routes resolve on refresh.
RUN printf 'server {\n  listen 80;\n  location / { root /usr/share/nginx/html; index index.html; try_files $uri /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
