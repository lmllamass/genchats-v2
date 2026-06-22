# Hostinger deploy for Genchats V2

Use a separate Hostinger project for V2.

Recommended domains:

- Frontend: `https://v2.genchats.app`
- Backend: `https://api-v2.genchats.app`

## Frontend environment variables

Set these before building the frontend:

```env
VITE_SUPABASE_URL=https://your-v2-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
VITE_API_URL=https://api-v2.genchats.app
VITE_APP_URL=https://v2.genchats.app
VITE_GENA_PROYECTO_ID=
```

Build command:

```bash
npm ci
npm run build
```

Output directory:

```text
dist
```

## Backend environment variables

Set these in the backend service:

```env
SUPABASE_URL=https://your-v2-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_secret_key
SUPABASE_ANON_KEY=your_supabase_publishable_key
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
FIRECRAWL_API_KEY=your_firecrawl_api_key
YCLOUD_API_KEY=your_ycloud_api_key
STRIPE_SECRET_KEY=sk_test_or_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=noreply@genchats.app
PORT=4000
APP_URL=https://v2.genchats.app
API_PUBLIC_URL=https://api-v2.genchats.app
```

Start command:

```bash
npm ci --omit=dev
npm start
```

Backend folder:

```text
backend
```

## Smoke checks

After deploy:

```text
https://api-v2.genchats.app/health
https://api-v2.genchats.app/api/monitor
https://v2.genchats.app
```

Do not configure YCloud, Telegram, Retell or Stripe production webhooks until
the V2 domains are confirmed healthy.
