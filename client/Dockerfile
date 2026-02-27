# ─── Dev stage: Vite dev server with HMR ────────────────────────────────────
FROM node:22-alpine AS dev
WORKDIR /app
# Install deps into the image; source files are mounted as a volume
COPY package.json package-lock.json* ./
RUN npm install
EXPOSE 8080
CMD ["npm", "run", "dev"]

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ─── Production: nginx serves the built files + proxies API/WS ───────────────
FROM nginx:1.27-alpine AS prod
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
