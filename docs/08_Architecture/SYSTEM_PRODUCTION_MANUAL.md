# SYSTEM PRODUCTION MANUAL — SN-ERMS

## Architecture

- `client-app` — React 18 + Vite PWA + i18n  
- `backend-service` — Express + Prisma + PostgreSQL + JWT  
- Voice: `/api/v1/voice-agent` (local rules or optional OpenAI-compatible LLM)  
- Jobs: `operations.job.ts` hourly stage / stock / weather  

## Database

```bash
cd backend-service
npx prisma migrate deploy
npx prisma generate
npm run seed   # if available
```

## Local run (Windows)

```bash
cd backend-service && npm run dev   # :4000
cd client-app && npm run dev        # https://localhost:5173
```

Do **not** run `.cursor/install.sh` / `start.sh` on this Windows PC.

## Voice LLM (optional)

```env
VOICE_LLM_API_KEY=...
VOICE_LLM_BASE_URL=https://api.openai.com/v1
VOICE_LLM_MODEL=gpt-4o-mini
```

Empty keys → local intent parser (testing OK).

## Testing simulation

Paid WhatsApp / NVR / thermal printer: use mock interceptor UI (Section 4) — proceed with simulated latency/success or open credentials drawer.

## Deploy sketch

- API behind reverse proxy TLS  
- `NODE_ENV=production` + strong `JWT_SECRET` (≥24)  
- PM2: `pm2 start dist/server.js --name sn-erms-api`  
- Client: static `dist` on HTTPS  

## Flutter

See `flutter_mobile_app/README.md` (scaffold track).
