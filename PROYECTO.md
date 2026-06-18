# GenChats — Documentación técnica del proyecto

> Última actualización: 25 mayo 2026 · Commit `1308fe2`

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Infraestructura en Easypanel](#2-infraestructura-en-easypanel)
3. [Backend — Express API](#3-backend--express-api)
4. [Frontend — React/Vite](#4-frontend--reactvite)
5. [Base de datos — Supabase](#5-base-de-datos--supabase)
6. [Canales de chatbot](#6-canales-de-chatbot)
7. [Panel de administración](#7-panel-de-administración)
8. [Stripe — Pagos y suscripciones](#8-stripe--pagos-y-suscripciones)
9. [Variables de entorno](#9-variables-de-entorno)
10. [Despliegue manual](#10-despliegue-manual)
11. [Migración de dominio pendiente](#11-migración-de-dominio-pendiente)
12. [Checklist de pruebas](#12-checklist-de-pruebas)
13. [Histórico de cambios relevantes](#13-histórico-de-cambios-relevantes)

---

## 1. Arquitectura general

```
Usuario final
    │
    ├── Web chatbot embed  ────────────────────────────────────────────────┐
    ├── WhatsApp (YCloud)  ─→ POST /api/ycloud/webhook                    │
    └── Telegram Bot       ─→ POST /api/telegram/webhook/:proyecto_id     │
                                                                           │
                                                           ┌──────────────▼──────────────┐
                                                           │   genchats-api (Node/Express)│
                                                           │   puerto 4000               │
                                                           │                             │
                                                           │  backend/lib/agentCore.js   │
                                                           │  ┌─────────────────────────┐│
                                                           │  │  Claude Haiku 4-5       ││
                                                           │  │  Agentic loop (max 4)   ││
                                                           │  │  Tools:                 ││
                                                           │  │  · guardar_contacto     ││
                                                           │  │  · buscar_productos     ││
                                                           │  │  · ver_categorias       ││
                                                           │  └─────────────────────────┘│
                                                           └─────────────┬───────────────┘
                                                                         │
                                            ┌────────────────────────────┼────────────────┐
                                            │                            │                │
                                    ┌───────▼──────┐           ┌────────▼───────┐  ┌─────▼──────┐
                                    │   Supabase   │           │  Anthropic API │  │   Resend   │
                                    │  (self-host) │           │  Claude Haiku  │  │  (emails)  │
                                    │  PostgreSQL  │           └────────────────┘  └────────────┘
                                    └──────────────┘
```

---

## 2. Infraestructura en Easypanel

- **VPS**: `72.62.24.150`
- **Panel**: Easypanel v2.30.1 (Docker Swarm)
- **Proyecto en Easypanel**: `demo`

| Servicio Easypanel | Docker service name | URL pública |
|---|---|---|
| `genchats-api` | `demo_genchats-api` | `https://api.genchats.app` |
| `genchats-frontend` | `demo_genchats-frontend` | `https://genchats.app` |
| `supabase-db` | `demo_supabase-db-1` | (interno) |
| `supabase-kong` | `demo_supabase-kong-1` | `https://demo-supabase.v9bpad.easypanel.host` |
| `supabase-auth` | `demo_supabase-auth-1` | (interno) |
| `supabase-rest` | `demo_supabase-rest-1` | (interno) |

### Acceso SSH
```bash
ssh root@72.62.24.150
```

### Acceso directo a la BD (psql)
```bash
ssh root@72.62.24.150 "docker exec demo_supabase-db-1 psql -U supabase_admin -d postgres"
```

---

## 3. Backend — Express API

### Estructura de archivos
```
backend/
├── server.js                    # Entry point, middlewares, rutas
├── lib/
│   ├── agentCore.js             # ★ Lógica Claude compartida por todos los canales
│   └── ecommerceConnectors.js   # Conectores WooCommerce / Google Sheets / Odoo
└── routes/
    ├── admin.js                 # /api/admin/* (requiere auth admin)
    ├── chatbotRespond.js        # /api/chatbot/respond (chat web)
    ├── publicChatbot.js         # /api/chatbot-public/:id/* (embed público)
    ├── telegramWebhook.js       # /api/telegram/webhook/:proyecto_id
    ├── ycloudWebhook.js         # /api/ycloud/webhook (WhatsApp)
    ├── generarChatbot.js        # /api/generar-chatbot
    ├── generarPagina.js         # /api/generar-pagina
    ├── scrapeUrl.js             # /api/scrape
    ├── stripe.js                # /api/stripe/*
    ├── notify.js                # /api/notify/*
    ├── ycloud.js                # /api/ycloud-config/*
    ├── exportar.js              # /api/exportar
    └── queryProducts.js         # /api/products/*
```

### `backend/lib/agentCore.js` — módulo central

Centraliza **toda** la lógica de IA. Todos los canales (web, WhatsApp, Telegram) importan de aquí.

| Función exportada | Descripción |
|---|---|
| `createAnthropicClient()` | Crea cliente Anthropic con la API key del entorno |
| `callWithRetry(fn, maxRetries)` | Retry automático en errores 529 (Anthropic overloaded) |
| `buildTools(hasEcommerce, platform)` | Devuelve array de tools: `guardar_contacto`, `buscar_productos`, `ver_categorias` |
| `executeTool(name, input, ctx)` | Ejecuta una tool, guarda lead en Supabase, envía email Resend |
| `runAgentLoop(anthropic, {system, tools, messages}, ctx, maxIter)` | Loop agentico Claude Haiku (máx 4 iteraciones) |
| `buildSystemPrompt(proyecto, config, lead, canal)` | System prompt con instrucciones de formato por canal |
| `markdownToWhatsApp(text)` | Convierte Markdown a texto plano compatible WhatsApp |
| `loadHistory(proyecto_id, visitor_id, currentMsg)` | Carga últimos 20 mensajes de `conversaciones_chat` |
| `loadExistingLead(proyecto_id, visitor_id)` | Carga lead existente de tabla `leads` |

**Formato por canal:**
- `web`: Markdown completo `[texto](url)`
- `whatsapp`: `*negrita*`, sin corchetes, URLs directas
- `telegram`: texto plano (strip de Markdown antes de enviar)

### Endpoints principales

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/api/scrape` | — | Scraping de URL con Firecrawl |
| POST | `/api/chatbot/respond` | — | Chat web (usuario autenticado) |
| GET | `/api/chatbot-public/:id/config` | — | Config pública del chatbot |
| POST | `/api/chatbot-public/:id/message` | — | Mensaje al chatbot público (embed) |
| POST | `/api/ycloud/webhook` | — | Webhook WhatsApp (YCloud) |
| POST | `/api/telegram/webhook/:proyecto_id` | — | Webhook Telegram Bot |
| POST | `/api/generar-chatbot` | — | Genera configuración chatbot con Claude |
| POST | `/api/generar-pagina` | — | Genera página web con Claude |
| POST | `/api/stripe/checkout` | — | Crea sesión Stripe Checkout |
| POST | `/api/stripe/portal` | — | Portal cliente Stripe |
| POST | `/api/stripe/webhook` | — | Webhook Stripe (raw body) |
| POST | `/api/exportar` | — | Exporta configuración del proyecto |
| POST | `/api/notify/lead` | — | Email notificación nuevo lead |
| POST | `/api/notify/pro-activation` | — | Email activación Pro |
| GET | `/api/admin/config` | Admin JWT | Config plataforma |
| PUT | `/api/admin/config` | Admin JWT | Actualiza config plataforma |
| GET | `/api/admin/usuarios` | Admin JWT | Lista usuarios (service role) |
| PATCH | `/api/admin/usuarios/:id` | Admin JWT | Actualiza perfil usuario |
| GET | `/api/admin/proyectos` | Admin JWT | Lista todos los proyectos |
| PATCH | `/api/admin/proyectos/:id` | Admin JWT | Actualiza cualquier proyecto (bypass RLS) |
| POST | `/api/admin/invitar` | Admin JWT | Invita usuario por email (Resend) |
| POST | `/api/admin/telegram/registrar-webhook` | Admin JWT | Registra webhook en Telegram API |
| POST | `/api/admin/reset-mensajes` | Admin JWT | Resetea contadores mensuales |

**Middleware admin:**
```javascript
// Solo lmllamas@gmail.com puede acceder a /api/admin/*
async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || user.email !== 'lmllamas@gmail.com') return res.status(403).json({ error: 'Forbidden' });
  next();
}
```

---

## 4. Frontend — React/Vite

### Estructura de páginas
```
src/
├── pages/
│   ├── Landing.jsx              # Página de inicio pública
│   ├── Login.jsx                # Login / registro
│   ├── ResetPassword.jsx        # Reset contraseña (desde email invite)
│   ├── Dashboard.jsx            # Dashboard usuario autenticado
│   ├── Asistente.jsx            # Wizard creación de proyecto
│   ├── Editor.jsx               # Editor del chatbot (con tabs)
│   ├── ChatbotPublic.jsx        # Chat público embebido /chat/:id
│   ├── Planes.jsx               # Página de precios
│   ├── Activacion.jsx           # Confirmación post-pago Stripe
│   ├── MiCuenta.jsx             # Perfil del usuario
│   ├── Exportar.jsx             # Exportar proyecto
│   └── admin/
│       ├── AdminDashboard.jsx   # Métricas globales
│       ├── AdminUsuarios.jsx    # Gestión usuarios
│       ├── AdminProyectos.jsx   # Lista todos los proyectos
│       ├── AdminProyectoDetalle.jsx  # WhatsApp + Telegram por proyecto
│       ├── AdminLogs.jsx        # Conversaciones recientes
│       └── AdminConfiguracion.jsx   # Config plataforma (Stripe, YCloud, etc.)
├── components/
│   ├── admin/
│   │   ├── TelegramProjectSection.jsx   # Config bot Telegram por proyecto
│   │   ├── WhatsAppProjectSection.jsx   # Config WhatsApp/YCloud por proyecto
│   │   ├── WhatsAppMessageHistory.jsx   # Historial mensajes WA
│   │   ├── UserEditDialog.jsx           # Dialog edición usuario
│   │   └── UserDeleteDialog.jsx
│   ├── editor/                  # Componentes del editor de chatbot
│   ├── chatbot/                 # Widget de chat público
│   ├── wizard/                  # Pasos del asistente de creación
│   └── landing/                 # Secciones de la landing page
└── api/
    ├── backendApi.js            # Llamadas al backend Express
    ├── entidades.js             # CRUD directo a Supabase (anon key)
    └── supabaseClient.js        # Cliente Supabase
```

### Variables de entorno frontend (`.env.production.local`)
```env
VITE_SUPABASE_URL=https://demo-supabase.v9bpad.easypanel.host
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://api.genchats.app
```

---

## 5. Base de datos — Supabase

### Tablas principales

#### `proyectos`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `nombre` | TEXT | Nombre del proyecto |
| `url_origen` | TEXT | URL scrapeada |
| `estado` | TEXT | `scrapeando` \| `generando` \| `activo` \| `pro_activo` \| `pausado` \| `inactivo` |
| `chatbot_config` | JSONB | Config del chatbot (nombre, color, prompt base, etc.) |
| `ecommerce_config` | JSONB | Config ecommerce (plataforma, credenciales) |
| `system_prompt` | TEXT | Prompt generado por Claude |
| `ycloud_api_key` | TEXT | API key YCloud (WhatsApp) |
| `ycloud_phone_number` | TEXT | Número WhatsApp Business |
| `whatsapp_activo` | BOOL | Activa el canal WhatsApp |
| `modo_atencion` | TEXT | `bot` \| `coexistencia` \| `humano` |
| `telegram_token` | TEXT | Token bot Telegram (@BotFather) |
| `telegram_username` | TEXT | @username del bot |
| `telegram_activo` | BOOL | Activa el canal Telegram |
| `mensajes_mes` | INT | Contador mensual (se resetea) |
| `limite_mensajes` | INT | Límite mensual (default 200) |

> **RLS**: `auth.uid() = user_id` — el admin debe usar el backend (service role) para modificar proyectos de otros usuarios.

#### `user_profiles`
| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | FK → auth.users |
| `email` | TEXT | Email |
| `full_name` | TEXT | Nombre completo |
| `role` | TEXT | `user` \| `admin` |
| `plan` | TEXT | `free` \| `pro` \| `agencia` |
| `estado` | TEXT | `activo` \| `inactivo` \| `suspendido` |
| `trial_ends_at` | TIMESTAMPTZ | Fin del trial (7 días desde registro) |
| `plan_activated_at` | TIMESTAMPTZ | Cuándo se activó plan Pro |
| `telefono` | TEXT | Teléfono de contacto |
| `empresa` | TEXT | Nombre empresa |
| `direccion` | TEXT | Dirección |
| `notas_admin` | TEXT | Notas internas admin |
| `stripe_customer_id` | TEXT | ID cliente Stripe |
| `stripe_subscription_id` | TEXT | ID suscripción Stripe |

#### `leads`
Leads capturados por el chatbot. Se crean via tool `guardar_contacto`.

| Campo | Tipo |
|---|---|
| `proyecto_id` | UUID |
| `visitor_id` | TEXT (ej: `tg_123456`, `wa_+34600...`, `uuid-web`) |
| `canal` | `web` \| `whatsapp` \| `telegram` \| `embed` |
| `nombre`, `email`, `telefono`, `empresa` | TEXT |
| `notas` | TEXT |

#### `conversaciones_chat`
Historial de mensajes. Se usa para contexto (últimos 20 por visitor).

#### `config_plataforma`
Singleton (clave='plataforma'). Contiene config global: YCloud, Stripe, Resend, límites.

### Migraciones aplicadas
| Archivo | Descripción |
|---|---|
| `supabase-schema.sql` | Schema inicial completo |
| `supabase-migrations/002_add_user_profile_columns.sql` | Añade telefono, empresa, direccion, notas_admin, plan_activated_at, estado a user_profiles |

---

## 6. Canales de chatbot

### Web (embed)
- **Ruta**: `/api/chatbot-public/:id/message`
- **Identificador visitante**: UUID generado en el navegador (localStorage)
- **Formato respuesta**: Markdown completo
- **Snippet embed**: `<script src="https://genchats.app/embed.js" data-project-id="UUID"></script>`

### WhatsApp (YCloud)
- **Ruta webhook**: `POST /api/ycloud/webhook`
- **Configuración por proyecto**: `ycloud_api_key` + `ycloud_phone_number` en tabla `proyectos`
- **URL webhook para YCloud**: `https://api.genchats.app/api/ycloud/webhook`
- **Formato respuesta**: texto plano (Markdown convertido con `markdownToWhatsApp()`)
- **Identificador visitante**: `wa_+34XXXXXXXXX`
- **Requisito**: proyecto con `estado = 'activo'` o `'pro_activo'`

### Telegram
- **Ruta webhook**: `POST /api/telegram/webhook/:proyecto_id`
- **Configuración por proyecto**: `telegram_token` en tabla `proyectos`
- **Registro webhook**: Admin → Proyectos → [proyecto] → botón "Registrar webhook automáticamente" (llama a `POST https://api.telegram.org/bot{TOKEN}/setWebhook`)
- **Formato respuesta**: texto plano (sin parse_mode, Markdown strips antes de enviar)
- **Identificador visitante**: `tg_TELEGRAM_USER_ID`
- **Typing indicator**: envía `sendChatAction: 'typing'` mientras Claude procesa
- **Requisito**: proyecto con `estado = 'activo'` o `'pro_activo'`

---

## 7. Panel de administración

**Acceso**: `/admin` (solo `lmllamas@gmail.com`)

### AdminUsuarios (`/admin/usuarios`)
- Lista todos los usuarios (via backend service role, sin restricción RLS)
- Botón **`→Pro`** / **`→Free`** directo en tabla
- Botón ✏️ abre `UserEditDialog`: edita telefono, empresa, direccion, plan, role, notas_admin
- Botón 🗑️ desactiva usuario (`estado = 'inactivo'`)
- Invitación por email (Resend)

### AdminProyectos (`/admin/proyectos`)
- Lista todos los proyectos con filtros (estado, búsqueda)
- Columna **Modo**: toggle `🤖 Bot` ↔ `🤝 Coexistencia` (via backend, bypass RLS)
- Botón **WA** → navega a `AdminProyectoDetalle`
- Botón ⚙️ YCloud: edita `ycloud_api_key` y `ycloud_phone_number`
- Botón **Bot** 🤖: regenera chatbot (llama a `/api/generar-chatbot`)

### AdminProyectoDetalle (`/admin/proyectos/:id`)
- Badge de **estado clickeable** → cicla: activo → pro_activo → pausado → inactivo
- Botón rápido **`→ Pro Activo`** para activar el proyecto para bots
- **WhatsAppProjectSection**: configura YCloud para ese proyecto específico
- **TelegramProjectSection**: configura token bot, registra webhook automáticamente
- **WhatsAppMessageHistory**: historial de mensajes de WhatsApp

### AdminConfiguracion (`/admin/configuracion`)
- Configuración global: YCloud, Stripe (Price IDs), Resend, límites de mensajes
- Los Price IDs de Stripe se configuran aquí (NO son variables de entorno)

---

## 8. Stripe — Pagos y suscripciones

### Flujo de pago
1. Usuario va a `/planes` → pulsa "Suscribirse"
2. Frontend llama a `POST /api/stripe/checkout` con `{ user_id, email, proyecto_id }`
3. Backend lee los Price IDs de `config_plataforma` → crea Stripe Checkout Session
4. Redirige a Stripe Checkout (tarjeta de test: `4242 4242 4242 4242`)
5. Tras pago: redirige a `/activacion?session_id=...`
6. Webhook Stripe `checkout.session.completed` → backend actualiza `proyectos.estado = 'pro_activo'`

### Estado actual (test mode)
- [x] `STRIPE_SECRET_KEY` = `sk_test_51SDkmu...` configurado en Easypanel
- [x] `STRIPE_WEBHOOK_SECRET` = `whsec_JKmXHko6...` configurado
- [x] Webhook test: `https://api.genchats.app/api/stripe/webhook`
- [x] Price ID test Pro: `price_1SwRjQG6GJSBuOW4o34JuE3t` en `config_plataforma`

### Pendiente — cambio a modo LIVE antes de launch
- [ ] Actualizar `STRIPE_SECRET_KEY` → `sk_live_51...`
- [ ] Crear webhook live en Stripe → copiar `whsec_` live → actualizar `STRIPE_WEBHOOK_SECRET`
- [ ] Actualizar Price IDs en Admin → Configuración → Stripe (plan Pro + Agencia live)

---

## 9. Variables de entorno

### Backend (`genchats-api` en Easypanel)

| Variable | Estado | Descripción |
|---|---|---|
| `SUPABASE_URL` | ✅ configurada | URL de Supabase Kong |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ configurada | Service role JWT |
| `ANTHROPIC_API_KEY` | ✅ configurada | Clave Claude API |
| `RESEND_API_KEY` | ✅ configurada | Clave Resend emails |
| `RESEND_FROM_EMAIL` | ✅ configurada | `noreply@genchats.app` |
| `APP_URL` | ✅ configurada | URL pública frontend |
| `API_PUBLIC_URL` | ✅ configurada | URL pública backend |
| `YCLOUD_API_KEY` | ✅ configurada | API Key YCloud (WhatsApp global) |
| `PORT` | ✅ configurada | `4000` |
| `STRIPE_SECRET_KEY` | ❌ **pendiente** | `sk_live_...` o `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | ❌ **pendiente** | `whsec_...` |
| `FIRECRAWL_API_KEY` | ⚪ opcional | Scraping avanzado |

### Frontend (`genchats-frontend` en Easypanel)

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL Supabase Kong |
| `VITE_SUPABASE_ANON_KEY` | Anon key JWT |
| `VITE_API_URL` | URL backend Express |

---

## 10. Despliegue manual

### Backend (cuando hay cambios en `backend/`)
```bash
# Desde local — sincronizar código
cd /Users/lmllamas/Desktop/genchats
rsync -avz --delete --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  . root@72.62.24.150:/root/genchats/

# En el VPS — reconstruir imagen y actualizar servicio
ssh root@72.62.24.150 '
  cd /root/genchats
  docker build -t genchats-api:latest .
  docker service update --force --image genchats-api:latest demo_genchats-api
'
```

### Frontend (cuando hay cambios en `src/`)
```bash
cd /Users/lmllamas/Desktop/genchats

# 1. Build local
npm run build

# 2. Empaquetar y subir
tar czf /tmp/genchats-dist.tar.gz dist/
scp /tmp/genchats-dist.tar.gz root@72.62.24.150:/tmp/

# 3. Inyectar en el contenedor nginx
ssh root@72.62.24.150 '
  CONTAINER=$(docker ps --filter "name=demo_genchats-frontend" --format "{{.ID}}" | head -1)
  docker cp /tmp/genchats-dist.tar.gz $CONTAINER:/tmp/
  docker exec $CONTAINER sh -c "
    rm -rf /usr/share/nginx/html/* &&
    tar xzf /tmp/genchats-dist.tar.gz -C /usr/share/nginx/html --strip-components=1 &&
    nginx -s reload
  "
'
```

### Migraciones SQL
```bash
# Ejecutar SQL directamente en la BD de Supabase
ssh root@72.62.24.150 'docker exec demo_supabase-db-1 psql -U supabase_admin -d postgres -c "TU_SQL_AQUÍ"'

# O pasar un fichero .sql
scp migration.sql root@72.62.24.150:/tmp/
ssh root@72.62.24.150 'docker exec -i demo_supabase-db-1 psql -U supabase_admin -d postgres < /tmp/migration.sql'
```

---

## 11. Migración de dominio — ✅ COMPLETADA

El dominio `genchats.app` ya está apuntando al VPS y con SSL activo.

| Item | Estado |
|---|---|
| DNS `A @ 72.62.24.150` (frontend) | ✅ |
| DNS `A api 72.62.24.150` (backend) | ✅ |
| Easypanel: dominio `genchats.app` + SSL en `genchats-frontend` | ✅ |
| Easypanel: dominio `api.genchats.app` + SSL en `genchats-api` | ✅ |
| `APP_URL=https://genchats.app` en env | ✅ |
| `API_PUBLIC_URL=https://api.genchats.app` en env | ✅ |
| `VITE_API_URL=https://api.genchats.app` en build frontend | ✅ |
| Supabase Auth: Site URL + Redirect URLs | ✅ |
| Stripe webhook: `https://api.genchats.app/api/stripe/webhook` | ✅ (test mode) |

---

## 12. Checklist de pruebas

### Autenticación
- [ ] Login email/contraseña
- [ ] Reset de contraseña: llega email → enlace funciona → permite crear contraseña nueva
- [ ] Admin invita usuario → llega email → usuario puede activar cuenta

### Chatbot web
- [ ] Crear proyecto → scraping de URL funciona
- [ ] Generar chatbot → Claude rellena la configuración
- [ ] Chatbot público responde en `/chat/:id`
- [ ] Chatbot captura lead (nombre + email) → aparece en Admin → Logs
- [ ] Email de notificación de lead llega a `notification_email` del proyecto

### WhatsApp (YCloud)
- [ ] Configurar YCloud API key + número en Admin → Proyectos → [proyecto]
- [ ] Proyecto en estado `activo` o `pro_activo`
- [ ] Enviar mensaje WhatsApp al número → chatbot responde
- [ ] Lead se crea en tabla `leads` con `canal = 'whatsapp'`
- [ ] Historial visible en Admin → Proyectos → [proyecto] → historial WA

### Telegram
- [ ] Crear bot en @BotFather → copiar token
- [ ] Admin → Proyectos → [proyecto] → pestaña Telegram → pegar token → Guardar
- [ ] Clic "Registrar webhook automáticamente" → mensaje de éxito
- [ ] Enviar mensaje al bot → chatbot responde
- [ ] Lead se crea con `canal = 'telegram'`

### Stripe / Pagos
- [ ] `/planes` → "Suscribirse" → redirige a Stripe Checkout
- [ ] Pago con `4242 4242 4242 4242` → redirige a `/activacion`
- [ ] Webhook llega (ver Stripe Dashboard → Webhooks)
- [ ] Proyecto queda `estado = 'pro_activo'`
- [ ] Email de activación Pro llega

### Admin
- [ ] Solo `lmllamas@gmail.com` puede entrar en `/admin`
- [ ] Editar usuario → cambiar plan/rol → guarda correctamente
- [ ] Botón `→Pro` en tabla → funciona sin abrir dialog
- [ ] Cambiar estado de proyecto a `pro_activo` desde la ficha
- [ ] Configuración → Stripe → guardar Price IDs

### Límites de plan
- [ ] Usuario free sin trial → `UpgradeWall` al intentar crear proyecto
- [ ] Usuario Pro → puede crear hasta 3 proyectos

---

## 13. Histórico de cambios relevantes

### Mayo 2026 — Sprint actual

#### Commit `1308fe2` (25 mayo 2026)
- **fix(scrape)**: timeouts aumentados (25s main / 18s subpages / 20s PDFs)
- Retry automático con params mínimos si Firecrawl falla en primera llamada
- Errores amigables en español (sin stack traces en respuesta)
- `backendApi.js`: timeout de scraping 90s, `stripeVerifySession()` añadido
- Eliminado error "signal is aborted without reason" con AbortSignal

#### Commit `ce3604c` (25 mayo 2026)
- **fix**: todas las URLs hardcoded `demo-genchats-api.v9bpad.easypanel.host` → `api.genchats.app`
- Afectados: `AdminConfiguracion.jsx`, `YCloudBlock.jsx`, `SystemStatusBlock.jsx`, `TelegramProjectSection.jsx`, `WhatsAppProjectSection.jsx`, `Step3Generate.jsx`, `backendApi.js`

#### Commit `c2a10e4` (25 mayo 2026)
- **feat**: favicon SVG creado en `public/favicon.svg` (gradiente indigo→violeta + icono MessageCircle)
- `index.html` actualizado: `lang=es`, favicon local, apple-touch-icon, og:image, theme-color, meta description

#### Commit `67c837b` (25 mayo 2026)
- **fix(stripe)**: flujo de activación completamente reescrito
- `Activacion.jsx`: era una página de onboarding, reescrita para verificar `session_id` desde URL
- `verify-session` endpoint añadido al backend (`GET /api/stripe/verify-session/:session_id`)
- Webhook actualiza `user_profiles.plan = 'pro'` (por `user_id` o email fallback)
- `Planes.jsx`: try/catch en `handleCheckout`, `user_id` enviado al backend, botón ya no se atasca
- Test Stripe configurado: keys `sk_test_`, webhook `whsec_`, price `price_1SwRjQG6GJSBuOW4o34JuE3t`

#### Commit `68ff38e` (25 mayo 2026)
- **fix**: `.catch()` → `.then(null, () => {})` en toda la base de código
- Supabase PromiseLike no siempre implementa `.catch()`, causaba errores silenciosos
- Afectados: `ycloudWebhook.js`, `telegramWebhook.js`, `stripe.js`

#### Commit `f2d9dcf` (25 mayo 2026)
- **feat**: WhatsApp + Telegram webhooks, agentCore refactor, admin fixes
- Extracción de lógica Claude a `backend/lib/agentCore.js`
- Nuevo webhook Telegram `POST /api/telegram/webhook/:proyecto_id`
- Reescritura de `ycloudWebhook.js`: OpenAI → Claude Haiku agentic loop
- `AdminProyectoDetalle`: botón de estado + uso de service role para updates
- `AdminProyectos`: uso de service role (bypass RLS) en todas las mutations
- `AdminUsuarios`: onError handlers para feedback de errores
- SQL migration `002`: añade columnas faltantes a `user_profiles`
- `PATCH /api/admin/proyectos/:id`: nuevo endpoint para admin

#### Cambios anteriores (sesiones previas)
- Integración Stripe con checkout + webhook + portal
- Sistema de invitación de usuarios (Resend)
- Panel admin completo (usuarios, proyectos, logs, configuración)
- Chatbot público con embed code
- Soporte ecommerce: Google Sheets, WooCommerce, Odoo
- Scraping con Firecrawl (multi-nivel, detección de PDFs)
- Captura de leads con notificación por email
- Trial de 7 días automático para usuarios free
- WhatsApp en modo coexistencia (bot + agente humano)

---

## 14. Pendiente antes del lanzamiento real

### Stripe live mode
Actualmente en **modo TEST**. Antes de aceptar pagos reales:
1. Easypanel → `genchats-api` → Environment → actualizar:
   - `STRIPE_SECRET_KEY` → `sk_live_51...`
   - `STRIPE_WEBHOOK_SECRET` → `whsec_OQ6D7xTUer3mG82wXLx7rhuf3HNC5J4a`
2. Stripe Dashboard → crear webhook **live** → `https://api.genchats.app/api/stripe/webhook`
3. Admin Panel → Configuración → actualizar Price IDs al live (`price_XXXXXXX`)

### Cancelación de suscripción
El evento `customer.subscription.deleted` tiene un TODO — implementar downgrade a plan free.

### Plan Agencia
Falta Price ID para el plan Agencia (197€/mes) en Stripe y en la DB.

### YCloud (primer cliente)
1. Contratar YCloud Growth ($39/mes)
2. Registrar número WhatsApp Business en Meta Business Manager
3. Admin Panel → Configuración → YCloud → API Key + webhook
4. Admin Panel → Proyecto del cliente → número de teléfono YCloud

---

## Repositorio

- **GitHub**: `https://github.com/lmllamass/genchats`
- **Rama principal**: `main`
- **⚠️ Pendiente**: rotar el PAT expuesto en la URL del remote git

---

*Generado con Claude Code · GenChats v1.0*
