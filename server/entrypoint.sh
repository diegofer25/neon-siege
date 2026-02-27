#!/bin/sh
set -e

echo "⚡  Running DB migrations..."
bun src/config/migrate.ts

echo "🚀  Starting server..."
exec bun src/index.ts
