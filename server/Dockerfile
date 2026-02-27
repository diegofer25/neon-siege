# ─── Base ────────────────────────────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# ─── Dev stage: hot-reload via bun --watch ────────────────────────────────────
FROM base AS dev
# Install dependencies into the image (src/ is mounted as a volume at runtime)
COPY package.json bun.lockb* ./
RUN bun install
# Copy config files needed at container start
COPY tsconfig.json ./
COPY entrypoint.dev.sh ./
RUN chmod +x entrypoint.dev.sh
# src/ and migrations/ are mounted by docker-compose.dev.yml
EXPOSE 3000
CMD ["./entrypoint.dev.sh"]

# ─── Production stage ────────────────────────────────────────────────────────
FROM base AS prod
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile
COPY . .
RUN chmod +x entrypoint.sh
EXPOSE 3000
CMD ["./entrypoint.sh"]
