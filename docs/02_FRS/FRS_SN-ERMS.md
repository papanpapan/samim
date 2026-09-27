# SN-ERMS Functional Requirements Specification (FRS)

## FRS-VOICE-01 Voice Agent

| ID | Requirement |
|----|-------------|
| FRS-VOICE-01.1 | `POST /api/v1/voice-agent/parse` returns intent + preview + `needsConfirmation` |
| FRS-VOICE-01.2 | Intents: `query_stock`, `add_inventory`, `register_mother`, `log_scions`, `get_daily_sales` |
| FRS-VOICE-01.3 | Without LLM keys, local rule parser works |
| FRS-VOICE-01.4 | `POST /api/v1/voice-agent/execute` runs only when `confirmed: true` |
| FRS-VOICE-01.5 | UI 5-state: LISTENING → PARSING → AWAITING_CONFIRMATION → EXECUTING → FEEDBACK |

## FRS-FIELD-01 Field Hub

| ID | Requirement |
|----|-------------|
| FRS-FIELD-01.1 | Route `/field` with three primary actions (min touch 14) |
| FRS-FIELD-01.2 | Care checklist completes via existing `/care/:id/complete` |
| FRS-FIELD-01.3 | Scion log via `/mother-plants/:id/scions` |
| FRS-FIELD-01.4 | Quick sale is inline on `/field` (scan → cart → Cash/UPI settle via `/sales`); full desk remains at `/pos` |
| FRS-FIELD-01.5 | Solo mode preference stored client-side |
| FRS-FIELD-01.6 | Care list shows only tasks due today or overdue (not future PENDING) |

## FRS-ACCESS-01 Access request

| ID | Requirement |
|----|-------------|
| FRS-ACCESS-01.1 | RoleGate/FeatureGate show request dialog, not silent blank |

## FRS-MONEY-01 Currency

| ID | Requirement |
|----|-------------|
| FRS-MONEY-01.1 | Nursery `currencyCode` drives `৳` / `₹` via `formatMoney` |

## FRS-AUTO-01 Lifecycle job

| ID | Requirement |
|----|-------------|
| FRS-AUTO-01.1 | Hourly job advances batch stages by day thresholds |
| FRS-AUTO-01.2 | Logs low-stock reorder hints |
| FRS-AUTO-01.3 | Open-Meteo weather sync when lat/lng present |
