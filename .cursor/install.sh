#!/usr/bin/env bash
# Idempotent repository bootstrap for the Saba Nursery ERMS monorepo.
# Installs PostgreSQL (system dep), prepares the database, and installs
# + generates dependencies for both the backend API and the PWA client.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PG_MAJOR=16

echo "==> Ensuring PostgreSQL is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

echo "==> Starting PostgreSQL cluster"
sudo pg_ctlcluster "$PG_MAJOR" main start 2>/dev/null || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done

echo "==> Ensuring database role and database exist"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='saba'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER saba WITH PASSWORD 'saba_dev_pw' CREATEDB;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='saba_nursery'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE saba_nursery OWNER saba;"

echo "==> Backend: install, generate client, migrate, seed"
cd "$ROOT/backend-service"
[ -f .env ] || cp .env.example .env
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed

echo "==> Client: install dependencies"
cd "$ROOT/client-app"
[ -f .env ] || cp .env.example .env
npm ci

echo "==> Install complete."
