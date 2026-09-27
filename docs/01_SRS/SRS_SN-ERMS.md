# SN-ERMS Software Requirements Specification (SRS)

**Product:** Saba Nursery ERMS (SN-ERMS)  
**Version:** 3.1 (production hardening track)  
**Audience:** Architects, implementers, UAT leads

## 1. Purpose

Convert SN-ERMS into a zero-training, field-autonomous, multi-tenant nursery ecosystem with web PWA, Flutter mobile, voice agent, and paid-service simulation.

## 2. Scope

| In scope | Out of scope (paid/external) |
|----------|------------------------------|
| Mother → Propagation → Inventory → POS ledger | Real WhatsApp Business API (mock OK) |
| Field Hub (care / scion / quick POS) | Physical NVR CCTV (mock OK) |
| Voice agent tool calling | Paid cloud TTS (mock / Edge TTS OK) |
| Multi-currency BDT/INR + GST testing | India IRP e-invoice |
| Tenancy, RBAC, feature gates | Hardware thermal printer firmware |

## 3. Actors

- Platform owner, Nursery admin, Manager, Staff, Cashier, Field worker (solo), Public plant share visitor

## 4. Functional requirements (summary)

- **FR-PLAT:** Onboard nursery, plans, features, channels, people  
- **FR-MP:** Mother registry with media and scion logs  
- **FR-PROP:** Batch stages mist → hardening → ready  
- **FR-INV / FR-POS:** Sellable stock and counter sales with currency/GST  
- **FR-FIELD:** Field Hub three-button daily mode  
- **FR-VOICE:** `/api/v1/voice-agent` parse + confirm + execute  
- **FR-AUTO:** Stage auto-advance, low-stock hints, weather sync  
- **FR-MOCK:** Interceptor for unpaid APIs/hardware  

## 5. Non-functional

- TypeScript strict; Zod validation; JWT auth; tenant filter  
- HTTPS client; no secrets in git; uploads size-limited  
- i18n: English + Bangla first-class; Hindi training scripts  

## 6. Related docs

- `docs/02_FRS/` — detailed FRS  
- `docs/03_User_Stories/`  
- `docs/08_Architecture/SYSTEM_PRODUCTION_MANUAL.md`  
