#!/bin/sh
set -e

echo "⚡  Running DB migrations..."
bun src/config/migrate.ts

echo "🚀  Starting server with hot-reload (bun --watch)..."
exec bun --watch src/index.ts
