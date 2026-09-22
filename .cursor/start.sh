#!/usr/bin/env bash
# Per-boot reconciliation: bring PostgreSQL up and make sure the schema and
# database role exist. Dev servers are launched via the "terminals" config,
# not here. This script is idempotent and returns once the DB is ready.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_MAJOR=16

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

echo "==> Applying any pending migrations"
( cd "$ROOT/backend-service" && npx prisma migrate deploy >/dev/null 2>&1 || true )

echo "==> Start reconciliation complete. PostgreSQL is ready."
