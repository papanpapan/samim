# Saba Nursery ERMS (SN-ERMS)

**Saba Nursery Enterprise Resource & Smart Inventory Management System** — a decoupled
enterprise platform for a commercial horticulture & exotic fruit-plant nursery.

Built from the technical specification (`docs/Saba_Nursery_Industrial_Enterprise_System_Specification.docx`),
following a **decoupled clean architecture**:

- **`backend-service/`** — standalone Node.js + Express + TypeScript REST API with Prisma ORM over PostgreSQL.
- **`client-app/`** — React + Vite + TypeScript **PWA** (installable on **Web, Android & iOS**) for dashboard, inventory and POS.

> The client is a Progressive Web App, so a single codebase installs to the home screen on
> Android and iOS and also runs in any browser. Native iOS/Android store builds can be added
> later (e.g. via Capacitor) — the API and UI are already mobile-first.

## Feature coverage (MVP)

| Domain | Status |
| --- | --- |
| Auth (JWT + bcrypt) & RBAC (ADMIN/MANAGER/STAFF/CASHIER) | ✅ |
| Mother plant registry + scion harvest tracking | ✅ |
| Propagation lifecycle (Initiate → Mist Chamber → Hardening → Ready) with mortality analytics | ✅ |
| Plant inventory with atomic stock ledger (ACID) | ✅ |
| Dynamic QR / barcode thermal label engine (50×25mm) | ✅ |
| Multi-channel POS (retail + tiered wholesale) with immutable ledger | ✅ |
| Vermicompost bed production & yield | ✅ |
| Dashboard KPIs + profitability report | ✅ |

## Quick start (local dev)

Prerequisites: Node.js 20+, PostgreSQL 14+.

```bash
# 1. Database (example role/db)
#    createuser saba; createdb saba_nursery -O saba

# 2. Backend
cd backend-service
cp .env.example .env            # adjust DATABASE_URL if needed
npm install
npx prisma migrate deploy       # or: npx prisma migrate dev
npm run seed                    # demo admin + sample data
npm run dev                     # http://localhost:4000

# 3. Client (in a second terminal)
cd client-app
npm install
npm run dev                     # http://localhost:5173
```

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@sabanursery.com` | `Admin@12345` |
| Manager | `manager@sabanursery.com` | `Manager@123` |
| Cashier | `cashier@sabanursery.com` | `Cashier@123` |
| Staff | `staff@sabanursery.com` | `Staff@123` |

## API

Base URL: `http://localhost:4000/api/v1` — see [`docs/api/openapi-v3.json`](docs/api/openapi-v3.json).
Health check: `GET /health`.

## Golden path

Login → Dashboard → register Mother Plant → create Propagation Batch → advance stages
(mortality auto-computed) → Mark Ready (creates inventory SKU + QR atomically) → POS scan &
checkout (stock decrements atomically, oversell blocked) → Reports.
