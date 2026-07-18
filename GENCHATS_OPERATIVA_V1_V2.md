# GenChats.app — Operativa y Configuración completa (v1 + v2)

> Documento de contexto vivo para el proyecto genchats.app. Se actualiza según avanza el
> desarrollo — es la fuente de verdad para no perder contexto entre sesiones/chats.
> Cubre la **v1** (chatbot web + WhatsApp + Telegram + voz + Stripe + admin) y la **v2**
> (reescritura con identidad omnicanal, BD Cloud propia, Actions Engine nativo).
>
> Última consolidación: **2026-07-10** · Repos: `github.com/lmllamass/genchats` (v1) y
> `github.com/lmllamass/genchats-v2` (v2).

---

## 0. TL;DR — Qué es GenChats y por qué existe

**GenChats.app es uno de los productos de [Konkabeza.com](https://konkabeza.es)** (agencia/estudio
del propietario). Es un SaaS que genera un **agente de IA por negocio (tenant)** a partir de su
web (scraping automático de contenido), y lo despliega en múltiples canales sin que el cliente
tenga que programar nada: **web embed, WhatsApp, Telegram y llamadas de voz (teléfono)**.

El cerebro es **Claude** vía tool-calling nativo, compartido por todos los canales a través de
un único módulo (`backend/lib/agentCore.js`). Es **multitenant**: cada proyecto (negocio) tiene
su propia configuración, base de conocimiento, conectores de ecommerce y herramientas (acciones)
propias — todo aislado por `proyecto_id`.

Planes: **Free/Gratis · Pro (49€/mes, +WhatsApp/Telegram) · Super Pro (99€/mes, +Voz)**.

**Misión del día a día:** iterar rápido sobre el producto (arreglar bugs reales que aparecen al
usar la app con clientes de prueba, mejorar el agente de voz, ampliar el motor de acciones) sin
romper lo que ya funciona en producción — de ahí la disciplina de git fetch+rebase antes de
desplegar, verificar en vivo tras cada cambio, y mantener este documento al día.

---

## 🔴 0.5 Dónde estamos AHORA (leer esto primero)

- **Desde 2026-07-09, se itera por defecto en v2**, no en v1. v1 queda de referencia/histórico.
  Todos los datos y API keys de v1 se migraron a v2 (proyectos, leads, pedidos, conversaciones,
  usuarios — ver §8.3). El agente de voz de **Suministros Aguado** (proyecto de prueba principal,
  `cc0cb1d1-d708-4a67-b961-59333874fd27`) ya está repuntado en Retell a `api-v2.genchats.app`.
- **El envío de WhatsApp fuera de la ventana de 24h — resuelto y confirmado en producción
  (2026-07-14)**: el primer intento (plantilla + texto libre después) NO funcionaba, mandar una
  plantilla no abre la ventana por sí sola. Ahora el mensaje va entero como variable DENTRO de la
  plantilla `genchats_info_agente` (una sola llamada), aprobada por Meta y probada con llamada
  real (ver §5.4).
- **Latencia y memoria del agente de voz — 2 bugs corregidos, solo en v2 por ahora (2026-07-10)**:
  saludo antes de resolver identidad (592ms→248ms) + combinar transcripción completa de la
  llamada con memoria omnicanal. **Pendiente portar a v1** (ver §5.4).
- **La BD de v1 en producción es Supabase Cloud** (`plsxmckjdxepawajjthc.supabase.co`), **NO** el
  Postgres self-hosted del VPS (`demo_supabase-db-1`) — ese contenedor es una copia vieja
  abandonada con datos congelados de mayo/junio. Ver §3.1, es una confusión fácil de repetir.
- Migración v1→v2 destapó 2 gaps de esquema en v2 (constraints de `plan` y `canal`) — **ya
  resueltos** por el usuario vía SQL directo (ver §8.4).

---

## 1. Arquitectura general

```
Usuario final
   │
   ├── Web embed          ─→ POST /api/chatbot-public/:id/message
   ├── WhatsApp (YCloud)  ─→ POST /api/ycloud/webhook           (texto + notas de voz)
   ├── Telegram Bot       ─→ POST /api/telegram/webhook/:id     (texto + notas de voz)
   └── Teléfono (Retell)  ─→ wss://api(-v2).genchats.app/api/retell/llm/:id   (WebSocket Custom LLM)
                                             │
                              ┌──────────────▼──────────────┐
                              │  genchats-backend (Node/Express + ws) │
                              │  v1: PM2 en el host · v2: docker-compose │
                              │                                       │
                              │  backend/lib/agentCore.js  ◀── cerebro único
                              │   · Claude Haiku 4.5 (tool_use nativo, streaming en voz) │
                              │   · runAgentLoop (máx 4 iteraciones)  │
                              │   Tools base:                         │
                              │    - guardar_contacto                 │
                              │    - buscar_productos / ver_categorias│
                              │   Tools de acción (NATIVAS):          │
                              │    - capturar_pedido → tabla pedidos  │
                              │    - concertar_cita  → tabla citas    │
                              │    - enviar_whatsapp → YCloud directo │
                              │   Tool de acción (n8n, solo ésta):     │
                              │    - custom                           │
                              └───────┬───────────┬───────────┬───────┘
                                      │           │           │
              ┌───────────────────────┤           │           ├─────────────┐
        ┌─────▼─────┐         ┌────────▼──────┐ ┌──▼────────┐ ┌▼──────────┐ ┌▼─────────┐
        │ Supabase  │         │ Anthropic     │ │ OpenAI    │ │ Retell AI │ │ n8n      │
        │ Postgres  │         │ Claude        │ │ Whisper   │ │ voz/tel.  │ │ acción   │
        │ CLOUD     │         │ (chat/agente) │ │ (STT)     │ │ (TTS/ASR) │ │ 'custom' │
        └───────────┘         └───────────────┘ └───────────┘ └───────────┘ └──────────┘
              │
        ┌─────▼─────┐   ┌──────────┐
        │  Resend   │   │  Stripe  │
        │  (emails) │   │  (pagos) │
        └───────────┘   └──────────┘
```

**v2 añade una capa de identidad omnicanal** (`customerIdentityService.js`): un mismo cliente que
escribe por WhatsApp y luego llama por teléfono se reconoce como **el mismo cliente** (por
teléfono/email) y el agente ve el historial unificado entre canales. En v1 esto no existía.

---

## 2. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite, TailwindCSS, shadcn/ui, React Router, TanStack Query, sonner |
| Backend | Node.js + Express (ESM), `ws` (WebSocket para Retell) |
| IA chat/agente | Anthropic Claude Haiku 4.5 (tool_use nativo; streaming en voz) |
| IA voz (STT) | OpenAI Whisper (`whisper-1`) — notas de voz WhatsApp/Telegram |
| IA voz (teléfono) | Retell AI (ASR + TTS) con **Custom LLM WebSocket** hacia nuestro backend |
| Base de datos | **Supabase Cloud** (PostgreSQL + Auth) — proyecto propio por versión, NO self-hosted |
| Auth | Supabase Auth (email/password + Google OAuth PKCE) |
| WhatsApp | YCloud (BSP oficial de Meta / WhatsApp Business API) |
| Telegram | Telegram Bot API (un bot por proyecto) |
| Telefonía voz | Retell AI + trunk SIP externo (Zadarma / Netelip) |
| Pagos | Stripe (Checkout + Portal + Webhooks) |
| Email | Resend |
| Automatización/acciones | n8n (solo para la acción `custom`; el resto es nativo) |
| Scraping | Firecrawl |

---

## 3. Infraestructura y despliegue

### 3.1 ⚠️ Bases de datos — la trampa más fácil de repetir

- **v1 usa Supabase Cloud**: `SUPABASE_URL=https://plsxmckjdxepawajjthc.supabase.co` en el
  `.env` del backend de v1. Resuelve a IPs de Cloudflare — es un proyecto Cloud real.
- **`demo_supabase-db-1`** (contenedor Postgres self-hosted en el VPS) es una **copia vieja y
  abandonada**. Tiene datos congelados (proyectos/mensajes de mayo-junio 2026) pero **el backend
  de v1 en producción NO lee ni escribe ahí**. Si necesitas verificar/depurar datos de v1, usa
  SIEMPRE el propio cliente del backend con sus credenciales reales de `.env`, nunca
  `docker exec demo_supabase-db-1 psql` a ciegas.
- **v2 usa OTRA Supabase Cloud distinta**: `trpqxsdsoydivdgrofaf.supabase.co`. v1 y v2 NO
  comparten base de datos — cada una tiene sus propios usuarios/auth, proyectos, etc. (por eso
  hizo falta una migración completa de datos, ver §8.3).
- Cómo consultar cualquiera de las dos correctamente: entrar por SSH al proceso/contenedor que
  las usa (PM2 de v1 o el contenedor `genchats-v2-api`) y ejecutar un script Node que use
  `process.env.SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` de ESE proceso — nunca asumir cuál es
  sin comprobarlo primero.

### 3.2 VPS / topología real

- **VPS**: `root@72.62.24.150` · Easypanel v2.30.1 (Docker Swarm) · proyecto Easypanel `demo`
- **v1 backend**: proceso **PM2 `genchats-backend`** en el HOST (NO Docker). Código en
  `/etc/easypanel/projects/demo/genchats-api/code/backend`. Escucha `:4000`.
  El servicio swarm `demo_genchats-api` es en realidad un NGINX que hace de proxy hacia el
  Node de PM2 — no te dejes engañar por el nombre.
- **v1 frontend**: contenedor nginx swarm `demo_genchats-frontend` (estático, overlay efímero).
- **v2 backend**: contenedor Docker **`genchats-v2-api`** (docker-compose, código en
  `/opt/genchats-v2`, checkout git de `main`). Puerto interno 4000 → expuesto 4002.
- **v2 frontend**: contenedor **`genchats-v2-frontend`** (docker-compose), puerto 8082.

| Servicio | URL pública |
|---|---|
| v1 Backend API | `https://api.genchats.app` |
| v1 Frontend | `https://genchats.app` |
| v2 Backend API | `https://api-v2.genchats.app` |
| v2 Frontend | `https://v2.genchats.app` |

### 3.3 Deploy

**v1** (desde `/Users/lmllamas/Desktop/genchats`, `./scripts/deploy.sh`):
```bash
./scripts/deploy.sh            # frontend + backend
./scripts/deploy.sh backend    # solo backend (empaqueta, scp, valida sintaxis, pm2 restart)
./scripts/deploy.sh frontend   # solo frontend (npm build, docker cp a nginx, nginx reload)
```
> El deploy de backend hace backup en `/root/genchats-deploy-backups/<fecha>`, valida cada
> `.js` con `node --check` (con `COPYFILE_DISABLE=1` para evitar ficheros AppleDouble de macOS)
> y reinicia PM2 con `--update-env`.

**v2** (desde `/Users/lmllamas/Desktop/genchats/genchats-v2`):
```bash
# En local: commit + push a main
git push origin main
# En el VPS:
cd /opt/genchats-v2 && git pull --ff-only
COMPOSE="docker compose"; $COMPOSE version >/dev/null 2>&1 || COMPOSE="docker-compose"
$COMPOSE -f docker-compose.production.yml up -d --build api        # o "frontend", o ambos
```

> ⚠️ **Los deploys son overlays efímeros** en ambas versiones: haz siempre `git push origin main`
> para persistir, o un rebuild de Easypanel/redeploy los borra.
>
> ⚠️ **SIEMPRE `git fetch origin main` antes de desplegar.** Hay sesiones paralelas (Codex u
> otras) trabajando en el mismo repo con frecuencia. Desplegar con un clon local desactualizado
> **revierte en producción** el trabajo de esas sesiones — ya ha pasado. Si hay divergencia, haz
> `git rebase origin/main` primero.
>
> ⚠️ **Al depurar con logs temporales + redeploy en bucle**, espera a que la petición anterior
> termine antes de volver a desplegar — cada redeploy reinicia el proceso y mata cualquier
> request async en curso (puede parecer un bug de negocio cuando es solo timing).

### 3.4 Acceso a BD y logs

```bash
# v1: logs del backend en vivo
ssh root@72.62.24.150 "pm2 logs genchats-backend --lines 0"
# v2: logs del backend en vivo
ssh root@72.62.24.150 "docker logs -f genchats-v2-api"
# Consultar datos reales de v1 o v2 (usar SIEMPRE las credenciales del propio proceso, ver §3.1):
ssh root@72.62.24.150 "cd /etc/easypanel/projects/demo/genchats-api/code/backend && node --input-type=module -e \"...\"" # v1
ssh root@72.62.24.150 "docker exec genchats-v2-api node -e \"...\""                                                        # v2
```

---

## 4. Backend — Express API (idéntico en v1 y v2 salvo lo indicado)

### Punto de entrada (`backend/server.js`)
- Middlewares globales (CORS `*`, JSON 10mb, raw body en `/api/stripe/webhook`).
- `process.on('uncaughtException'/'unhandledRejection', ...)` — loguea pero NO mata el proceso.
- Auth guards: `requireAuth` (usuario válido) y `requireAdmin` (solo `lmllamas@gmail.com`).
- **Servidor HTTP explícito** (`http.createServer`) para poder enganchar el WebSocket de Retell.

### Rutas montadas (resumen — ver código para el listado completo)
`/health` · `/api/retell/llm/:proyecto_id` (WS) · `/api/scrape` · `/api/chatbot/respond` ·
`/api/chatbot-public/:id/*` · `/api/ycloud/webhook` · `/api/telegram/webhook/:id` ·
`/api/generar-chatbot` · `/api/generar-pagina` · `/api/stripe/*` · `/api/notify/*` ·
`/api/ycloud-config/*` · `/api/products/*` · `/api/admin/*` (admin JWT) ·
`/api/conversations/*` · `/api/leads/*` (auth JWT).

### `backend/lib/agentCore.js` — el cerebro (compartido por TODOS los canales)
| Export | Descripción |
|---|---|
| `createAnthropicClient()` | Cliente Anthropic con la API key del entorno |
| `callWithRetry(fn, maxRetries=3)` | Retry ante 529 (Anthropic overloaded) |
| `buildTools(hasEcommerce, platform, enabledActionTools=[])` | Tools base + ecommerce + acciones habilitadas por proyecto |
| `executeTool(name, input, ctx)` | Ejecuta la tool: nativa (lead/pedido/cita/whatsapp/productos) o delega a n8n (`custom`) |
| `runAgentLoop(anthropic, {system,tools,messages}, ctx, maxIter=4, hooks={})` | Loop agéntico. `hooks.onDelta`/`onToolStart` habilitan **streaming + muletillas** en voz |
| `buildSystemPrompt(proyecto, config, lead, canal)` | System prompt con formato por canal |
| `markdownToWhatsApp(text)` | Markdown → texto WhatsApp |
| `loadHistory` / `loadExistingLead` | Contexto de conversación y lead existente |

**Streaming en voz (solo Retell, no afecta a web/WhatsApp/Telegram):** `runAgentLoop` acepta
`hooks.onDelta` (token a token, recorta el tiempo hasta la primera sílaba) y `hooks.onToolStart`
(dispara una muletilla — "Un momento, estoy localizando tu petición" — al empezar a ejecutar
cualquier tool, **sin condicionarlo** a que el modelo no haya dicho nada antes: Claude casi
siempre suelta un texto natural antes de llamar a una tool, así que esa condición nunca se
cumplía en la práctica y la muletilla no sonaba — bug corregido 2026-07-09).

**Formato de respuesta por canal:**
- `web`: Markdown completo `[texto](url)`
- `whatsapp`: `*negrita*`, sin corchetes, URLs directas
- `telegram`: HTML (`<b>`, `<a href>`)
- `phone` (Retell): frases cortas, sin markdown/emojis, no ofrece webs/emails por iniciativa
  propia, confirma en voz dígito a dígito cualquier número que el cliente dicte antes de usarlo

---

## 5. Canales

### 5.1 Web (embed)
`POST /api/chatbot-public/:id/message` · visitante = UUID en `localStorage`.

### 5.2 WhatsApp (YCloud) — texto + notas de voz
- Webhook: `POST /api/ycloud/webhook` · visitante = número de teléfono.
- Config por proyecto: `ycloud_api_key` + `ycloud_phone_number` (o clave global en
  `config_plataforma`). Gate real: `proyecto.estado IN ('activo','pro_activo')` — el campo
  `whatsapp_activo` es solo un flag de display, **no** bloquea el webhook.
- Notas de voz: se transcriben con Whisper (`downloadAndTranscribe`) antes de pasar al agente.
- Inbox: `human_takeover` por conversación + `modo_atencion` (`bot`/`humano`).

### 5.3 Telegram — texto + notas de voz
`POST /api/telegram/webhook/:proyecto_id` · visitante = `tg_<user_id>`. Igual patrón que WhatsApp.

### 5.4 Voz / Teléfono (Retell AI)

- **Endpoint WebSocket**: `wss://api(-v2).genchats.app/api/retell/llm/:proyecto_id`. El agente
  en el dashboard de Retell usa **Custom LLM** apuntando a esa URL.
- **Protocolo** (`backend/routes/retellWebhook.js`):
  1. Al conectar → `{ response_type: 'config', config:{auto_reconnect, call_details} }`.
  2. `call_details` → carga el proyecto y envía el **saludo proactivo** (`response_id: 0`).
     ⚠️ **Si `proyecto.retell_activo !== true`, cierra la llamada** (code 1008) sin saludar —
     causa más probable de "el agente no descuelga". La columna la crea la migración de campos
     Retell; si la BD se resetea sin reaplicarla, este bug reaparece.
  3. `response_required` → construye mensajes desde el `transcript`, ejecuta `runAgentLoop` con
     **streaming** y responde en fragmentos (`content_complete:false` hasta el final).
  4. `ping_pong` → eco (keepalive).
- **Muletillas**: array `FILLERS`, se dispara siempre al iniciar una tool (ver §4).
- **Latencia y memoria — 2 bugs medidos y corregidos (2026-07-10, solo v2 por ahora)**:
  1. El saludo esperaba a `resolveCustomerIdentity` (~9-10 llamadas secuenciales a BD, **592ms
     medidos**) sin necesitarlo. Se movió el envío del saludo antes de esa resolución →
     **248ms medidos tras el fix** (resto es red pura, no procesamiento).
  2. `agentMessages` sustituía la transcripción completa de la llamada actual (que Retell manda
     gratis en cada turno) por el historial omnicanal (`unifiedHistory`) en cuanto éste existía,
     dejando solo la última frase del cliente — el agente "olvidaba" lo dicho en la propia
     llamada a partir del 2º-3er turno. Ahora se combina: transcripción completa de Retell +
     contexto de OTROS canales (filtrando `[phone]` para no duplicar), con guarda de alternancia
     estricta user/assistant (requisito de la API de Anthropic). Verificado en vivo con 3 turnos:
     el agente recuerda el nombre dado en el turno 1 al preguntarle en el turno 3.
  - Análisis completo (por qué NO conviene migrar a agentes nativos de Retell/YCloud como
    alternativa a esto) hecho con `/superpowers` el 2026-07-10 — la causa real eran estos 2 bugs
    de implementación, no una limitación de arquitectura. **Pendiente: portar a v1.**
- **Confirmación de números dictados**: si el cliente dicta un teléfono de viva voz, el agente
  lo repite dígito a dígito y pide confirmación antes de usarlo — evita errores de transcripción
  STT (se detectó un caso real: `609212140` en vez de `609211040`).
- **Pronunciación de números**: en Retell, `handbook_config.speech_normalization` debe estar
  **`false`** (si no, pronuncia números de forma rara). `natural_filler_words` de Retell es
  independiente de nuestras propias muletillas.
- **`enviar_whatsapp` desde voz — resuelto de verdad (2026-07-13, v1 y v2)**: WhatsApp Business
  exige que el destinatario haya escrito primero (ventana de 24h) para recibir mensajes de texto
  libre. Alguien que llama por voz nunca ha escrito por WhatsApp, así que el envío proactivo
  directo **siempre fallaba** (confirmado con la API de YCloud: errores `131047` "more than 24
  hours have passed..." y `131026` "Message Undeliverable").
  - **Primer intento (2026-07-10, fallido en producción)**: crear la plantilla
    `genchats_seguimiento_llamada` (aprobada por Meta) y mandarla primero, seguida del mensaje
    libre. **Esto no funciona**: enviar una plantilla NO abre la ventana de 24h por sí sola, solo
    la abre una respuesta REAL del cliente. Se detectó en producción con mensajes reales que
    fallaban con `131047` justo después de mandar la plantilla (confirmado consultando el estado
    real de los `wamid` en la API de YCloud, no solo el `status: accepted` del envío).
  - **Fix real (2026-07-13)**: nueva plantilla `genchats_info_agente` (WABA
    `1405926177373607`, `officialTemplateId 1776480350164818`, cuerpo con 2 variables: `{{1}}`
    nombre del negocio, `{{2}}` el mensaje completo del agente) — el mensaje va ENTERO dentro de
    la plantilla en una sola llamada cuando la ventana está cerrada, sin depender de que el
    cliente responda. Las variables de plantilla no admiten saltos de línea ni espacios múltiples,
    así que el mensaje se sanea (`\n` → ` · `, colapsa espacios, cap ~900 caracteres) antes de
    mandarlo. Si la ventana SÍ está abierta, se sigue mandando texto libre normal (sin cambios).
    **Aprobada por Meta el 2026-07-14 y confirmada funcionando en producción** (probado con
    llamada real al agente de voz de Suministros Aguado enviando WhatsApp a un número que no
    había escrito antes).
  - v2 pasó de usar n8n a YCloud directo para este flujo (v1 ya lo hacía así).
  - Nota: la plantilla solo existe en la cuenta YCloud/WABA de Suministros Aguado por ahora —
    otros proyectos que necesiten WhatsApp proactivo fuera de ventana necesitarán su propia
    plantilla (el código falla de forma controlada si no existe o no está aprobada).
  - **Bug relacionado — el WhatsApp enviado desde voz no incluía enlaces de producto
    (2026-07-18, v1 y v2)**: el prompt de voz (`buildPhoneSystemPrompt` en
    `backend/routes/retellWebhook.js`) tiene reglas de FORMATO para lo hablado ("sin Markdown,
    sin URLs, sin corchetes, no ofrezcas webs por iniciativa propia") que, al ser un único system
    prompt para todo el turno, se aplicaban también al texto que Claude escribe en el parámetro
    `mensaje` de la herramienta `enviar_whatsapp` — así que el agente omitía los enlaces de
    producto (líneas `👉` del resultado de `buscar_productos`) también en el WhatsApp, algo que sí
    hace bien en el canal WhatsApp normal (que tiene su propio `formatInstructions` en
    `agentCore.js` que exige copiarlos literalmente). Fix: se añadió una nota explícita en el
    `whatsappNote`/`waNote` del prompt de voz aclarando que las restricciones de FORMATO son solo
    para lo hablado, y que el contenido de `mensaje` para `enviar_whatsapp` SÍ debe incluir los
    enlaces literalmente.
- Campos en `proyectos`: `retell_activo` (bool), `retell_phone_number`, `retell_agent_id`.
- Telefonía: número SIP externo (Zadarma o Netelip) conectado al trunk de Retell — la recepción
  de la llamada depende de que el proveedor SIP tenga el número activo y bien enrutado, algo
  fuera de nuestra infraestructura si falla.

---

## 6. Actions Engine — motor de acciones del agente

**Mayormente NATIVO desde 2026-07-09** (antes todo pasaba por n8n; se cambió porque v1 y v2 usan
BDs distintas, y enrutar por n8n habría requerido routing complejo BD↔proyecto):

| Tool | Cómo se ejecuta |
|---|---|
| `guardar_contacto` | Nativo — INSERT/UPDATE en `leads` + email al dueño (Resend) |
| `capturar_pedido` | Nativo — INSERT en `pedidos` + email al dueño (`notifyOwnerAccion`) |
| `concertar_cita` | Nativo — INSERT en `citas` + email al dueño |
| `enviar_whatsapp` | Nativo — YCloud directo con las credenciales del proyecto (ver limitación 24h en §5.4) |
| `buscar_productos` / `ver_categorias` | Nativo — conectores de ecommerce (`ecommerceConnectors.js`) |
| `custom` | **Único que sigue yendo a n8n** — `POST N8N_ACTIONS_WEBHOOK_URL`, para integraciones a medida por tenant. Workflow base creado en `demo-n8n.v9bpad.easypanel.host` ("GenChats — Acciones (custom)"), activo pero solo esqueleto |

- **Tabla `project_tools`**: qué tools están activas por proyecto (`enabled` + `config` JSONB).
- **Carga**: `loadProjectTools(supabase, projectId)` → inyectadas en `buildTools(...)` en los 4
  canales, incluida la voz (antes solo usaba `config.enabled_action_tools`, se corrigió).
- **Admin UI**: `ToolsProjectSection.jsx` en la ficha de proyecto.

---

## 7. Planes y Stripe

| Plan | Precio | Canales |
|---|---|---|
| Free / Gratis | 0€ | Web |
| Pro | 49€/mes | Web + WhatsApp + Telegram |
| Super Pro | 99€/mes | Todo + Voz IA (Retell) |

- **Gating verificado en BACKEND** (no solo frontend, desde 2026-07-06): `notify.js` comprueba
  el plan real del usuario contra `user_profiles` antes de avisar al admin de una solicitud de
  WhatsApp (requiere Pro+) o Voz (requiere Super Pro estricto — el fallback `pro_activo` del
  proyecto ya NO cuela para voz). Devuelve 403 si el plan es insuficiente.
- **Cada transición de plan avisa al admin** por email (`/api/notify/plan-change-admin`): alta,
  upgrade/downgrade, y cancelación → baja automática a `free` (antes era un TODO).
- **Checkout**: `POST /api/stripe/checkout` lee Price IDs de `config_plataforma` (no son env
  vars). Webhook: `checkout.session.completed` activa plan/proyecto.
- ⚠️ v2 aún no tiene su propio webhook de Stripe registrado en el dashboard — usa temporalmente
  las keys/webhook secret de v1 copiadas en su `.env.production` (pendiente configurar el suyo).

---

## 8. Base de datos (Supabase)

### 8.1 Tablas clave
`proyectos` (config JSONB, estado, canales), `user_profiles` (plan/role/trial), `leads` (CRM),
`conversaciones_chat` (historial), `conversaciones` (inbox), `project_tools`, `config_plataforma`
(singleton global), `mensajes_wa`, `pedidos`, `citas`.

**v2 añade**: `customers`, `customer_identities`, `customer_conversations`, `customer_messages`
(identidad omnicanal — dual-write junto a las tablas legacy).

### 8.2 Migraciones — reconciliadas 2026-07 (v1)
Se consolidaron dos carpetas dispersas en `supabase/migrations/` con formato timestamp del CLI
y se aplicó un baseline en `supabase_migrations.schema_migrations`. La reconciliación destapó que
el esquema de producción estaba **incompleto** (faltaban `conversaciones`, `lead_messages`,
`system_logs`, `project_tools` — reparado). *(Nota: esto se hizo sobre el self-hosted que
después se descubrió que v1 no usa en producción — ver §3.1. Pendiente re-verificar el estado de
migraciones contra la BD Cloud real de v1 si hace falta tocar su esquema de nuevo.)*

### 8.3 Migración completa v1 → v2 (2026-07-09)
Se migraron TODOS los datos de v1 a v2 (proyectos con **mismos IDs** — importante para no tener
que recrear agentes Retell, solo repuntar su `llm_websocket_url` —, leads, pedidos, conversaciones,
usuarios, mensajes). Todas las API keys críticas ya estaban copiadas de antes. Lección de bug de
migración: al construir un row para upsert con `{ campo_remapeado: X, ...spread(original) }`, si
el objeto original también tiene esa misma key, el spread la sobreescribe silenciosamente —
asignar siempre los campos remapeados (FKs) **después** de copiar el resto.

### 8.4 Gaps de esquema de v2 detectados y resueltos
- `user_profiles_plan_check` no permitía `'super-pro'` (solo `free`/`pro`) — rompía el gating de
  voz. Arreglado con `ALTER TABLE ... ADD CONSTRAINT ... CHECK (plan IN ('free','pro','super-pro'))`.
- `conversaciones_chat_canal_check` no permitía `'phone'` — el propio código de voz de v2 ya
  insertaba con ese valor y fallaba en silencio (`.then(null,()=>{})`). Arreglado igual, añadiendo
  `'phone'` al CHECK.
- Sin acceso DDL directo a ninguna Supabase Cloud (ni RPC de SQL) — estos cambios los tiene que
  ejecutar el usuario en el SQL Editor del dashboard.

---

## 9. Panel de administración (`/admin`, solo `lmllamas@gmail.com`)

`AdminUsuarios`, `AdminProyectos`, `AdminProyectoDetalle` (con `WhatsAppProjectSection`,
`TelegramProjectSection`, `ToolsProjectSection`), `AdminConfiguracion`, `/debug` (diagnóstico de
auth). *(Pendiente: sección para editar campos Retell desde la UI.)*

---

## 10. Variables de entorno (backend)

Prácticamente idénticas entre v1 y v2 (mismas API keys de Anthropic/Retell/Stripe/YCloud/Resend/
OpenAI/ElevenLabs/Firecrawl/AWS/VAPI — ya sincronizadas). Difieren solo las específicas de
entorno: `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (BDs distintas), `APP_URL`/`API_PUBLIC_URL`
(`genchats.app` vs `v2.genchats.app`), y `N8N_ACTIONS_WEBHOOK_URL` (mismo workflow, ambas
versiones apuntan al mismo webhook de n8n).

---

## 11. Runbook de diagnóstico (síntomas → causa)

**El teléfono (Retell) no descuelga / no saluda**
1. ¿Deploy aplicado en la versión correcta (v1 o v2)? → sección 3.3.
2. En logs, si `📞 Retell WS connected` y se cierra enseguida (code 1008) → `retell_activo` no
   es `true` para ese proyecto en la BD **real** que usa esa versión (§3.1) — ponlo a `true`.
3. La URL Custom LLM en Retell debe apuntar a la versión correcta (`api.` o `api-v2.`).

**El agente de voz no envía WhatsApp / el cliente dice que no le llega**
- Antes de asumir bug: comprobar con la API de YCloud (`GET /v2/whatsapp/messages?to=...`) el
  `errorCode` real. Si es `131047`/`131026` → es la ventana de 24h de Meta, no un bug (§5.4).
  Solo funciona si el cliente ya había escrito antes por WhatsApp, o tras aprobarse la plantilla.

**El agente no ejecuta acciones (cita/pedido/stock)**
1. `project_tools` con `enabled = true` para ese proyecto (admin → ToolsProjectSection).
2. Si es `capturar_pedido`/`concertar_cita`/`enviar_whatsapp`: son nativas, no dependen de n8n —
   revisar directamente los logs del backend (`[capturar_pedido] error:` etc.) y que existan las
   tablas `pedidos`/`citas` en la BD real de esa versión.
3. Si es `custom`: revisar `N8N_ACTIONS_WEBHOOK_URL` y el workflow en n8n.

**"No sé si estoy viendo la BD correcta"**
- Nunca asumas — verifica `SUPABASE_URL` del proceso real (PM2 de v1 o contenedor
  `genchats-v2-api`) antes de dar por buena cualquier consulta de datos (§3.1).

**Google OAuth deja la cuenta en blanco / vuelve al login**
- Causa habitual: Client Secret incorrecto en Supabase (Google provider). Página `/debug` para
  verificar el estado de sesión en vivo.

---

## 12. Pendientes conocidos

- [x] ~~Plantilla `genchats_seguimiento_llamada` + texto libre después~~ — descartado: mandar una
      plantilla no abre la ventana de 24h por sí sola, seguía fallando en producción (131047).
- [x] Plantilla `genchats_info_agente` (mensaje completo como variable) — aprobada por Meta el
      2026-07-14 y confirmado por el usuario que el envío de WhatsApp fuera de ventana funciona.
- [ ] Portar a v1 los 2 fixes de latencia/memoria del agente de voz (§0.5, §5.4) — solo en v2.
- [ ] Crear plantillas equivalentes para otros proyectos que necesiten WhatsApp proactivo fuera de
      ventana (de momento solo existe para Suministros Aguado).
- [ ] Webhook de Stripe propio para v2 (ahora mismo usa el de v1 copiado).
- [ ] Número de teléfono nuevo para el agente de pruebas de voz de v2 (Netelip, en validación
      ~24h, sin confirmar todavía).
- [ ] `RetellProjectSection` en el admin (editar campos Retell por proyecto desde la UI).
- [ ] Re-verificar estado de migraciones de v1 contra su BD Cloud real (§8.2 se hizo sobre la
      copia self-hosted equivocada).
- [ ] Stripe modo LIVE completo si aún queda algo en test.
- [ ] Rotar el PAT expuesto en la URL del remote git.

---

*Documento de operativa GenChats v1 + v2 — actualízalo según avance el desarrollo, es la base
de conocimiento del proyecto para evitar perder contexto entre sesiones.*
