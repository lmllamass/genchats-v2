# Supabase V2 setup

Use a separate Supabase project for Genchats V2. Do not apply these migrations
to the V1 production database.

## Required project settings

Copy these values from Supabase into local env files:

- Project URL -> `.env.local` and `backend/.env`
- Publishable key -> `.env.local` as `VITE_SUPABASE_ANON_KEY`
- Publishable key -> `backend/.env` as `SUPABASE_ANON_KEY`
- Secret key -> `backend/.env` as `SUPABASE_SERVICE_ROLE_KEY`

Never put the secret key in frontend env files.

## Migration order

Open Supabase SQL Editor and run the files in this order:

1. `supabase-schema.sql`
2. `supabase/migrations/001_conversaciones.sql`
3. `supabase/migrations/002_leads_crm.sql`
4. `supabase/migrations/003_oauth_profile_trigger.sql`
5. `supabase-migrations/002_add_user_profile_columns.sql`
6. `supabase-migrations/004_super_pro_plan.sql`
7. `supabase-migrations/005_sistema_logs.sql`
8. `supabase-migrations/006_retell_voice_fields.sql`
9. `supabase-migrations/007_project_tools.sql`
10. `supabase/migrations/004_omnichannel_identity.sql`

## What migration 004 adds

The V2 identity migration adds:

- `customers`: unified customer profile.
- `customer_identities`: phone, email, WhatsApp, Telegram, web visitor, Retell and IP identifiers.
- `customer_conversations`: channel-specific conversations connected to customers.
- `customer_messages`: normalized message history across channels.
- `customer_memory`: AI-ready customer summary and known facts.
- `customer_merge_suggestions`: suggested merges for uncertain identity matches.
- `customer_events`: future ecommerce/navigation tracking hook for V3.

## V2 identity rule

Automatic merge should only happen for high-confidence identifiers, such as:

- Same normalized phone.
- Same normalized email.
- Same WhatsApp sender number.

IP address, similar names, user agents or approximate location should be treated
only as low-confidence hints.
