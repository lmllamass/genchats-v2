# Genchats.app V2

Laboratorio V2 de Genchats.app.

Objetivo principal:

- Mantener la V1 estable.
- Evolucionar hacia una identidad omnicanal del cliente.
- Preparar la base para ecommerce intelligence en versiones posteriores.

## Estructura

- `src`: frontend React/Vite.
- `backend`: API Express.
- `supabase`: migraciones base.
- `supabase-migrations`: migraciones adicionales existentes.
- `base44`: configuracion historica de Base44.
- `MailSummary`: utilidad macOS separada.

## Entornos

Copia los ejemplos y rellena valores reales solo en local o en el servidor:

```bash
cp .env.frontend.example .env.local
cp backend/.env.example backend/.env
```

No subas archivos `.env` reales a GitHub.

## Desarrollo local

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
npm install
npm run dev
```

## V2: direccion de producto

La V2 debe introducir una capa de identidad:

- `customers`
- `customer_identities`
- `conversations`
- `messages`
- memoria/resumen del cliente

La V3 se orientara a comportamiento ecommerce: navegacion, carritos, compras, perfilado y prediccion de compra.
