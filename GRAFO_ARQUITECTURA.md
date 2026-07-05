# GenChats v2 — Grafo de arquitectura y procesos

> Repo/deploy **independiente** de la producción actual (`/Users/lmllamas/Desktop/genchats`, ver su
> [`GRAFO_ARQUITECTURA.md`](../GRAFO_ARQUITECTURA.md)). Es una reescritura/evolución del mismo backend
> Express + agentCore, con BD Cloud propia y una capa nueva de **identidad omnicanal**.
>
> ⚠️ `PROYECTO.md` de esta carpeta parece una copia sin actualizar del de v1 (menciona "Easypanel"; el
> despliegue real es docker-compose en `/opt/genchats-v2`, ver sección 5). Para infraestructura/despliegue
> fiate de este documento, no de `PROYECTO.md`.

## 1. Mapa de componentes

```mermaid
graph TD
    subgraph Frontend["Frontend — React/Vite (src/), mismo esqueleto que v1"]
        Landing["/ Landing.jsx"]
        Dashboard["/app Dashboard.jsx"]
        Editor["/editor/:id Editor.jsx"]
        Conv["/conversaciones Conversaciones.jsx"]
        Admin["/admin/* pages/admin/*"]
        ChatbotPublic["/chat/:id ChatbotPublic.jsx"]
    end

    subgraph Backend["Backend — Express (backend/server.js)\ndocker: genchats-v2-api :4000→4002"]
        YCloudWebhook["/api/ycloud/webhook ycloudWebhook.js"]
        TelegramWebhook["/api/telegram/webhook/:proyecto_id telegramWebhook.js"]
        RetellWS["WS /api/retell/llm/:projectId retellWebhook.js"]
        ChatbotRespond["/api/chatbot/respond chatbotRespond.js"]
        Conversations["/api/conversations conversations.js"]
        Leads["/api/leads leads.js"]
        StripeAPI["/api/stripe stripe.js"]
        Monitor["/api/monitor monitor.js"]
    end

    subgraph Core["Cerebro compartido (idéntico patrón a v1)"]
        AgentCore["lib/agentCore.js\nbuildSystemPrompt · runAgentLoop · buildTools"]
        IdentityService["lib/customerIdentityService.js\n★ NUEVO en v2: resolveCustomerIdentity()"]
        ActionsService["lib/actionsService.js → n8n"]
    end

    subgraph External["Servicios externos"]
        SupabaseCloud[("Supabase Postgres Cloud\n★ instancia PROPIA, distinta de v1")]
        Claude["Anthropic Claude"]
        Whisper["OpenAI Whisper (STT)"]
        Retell["Retell AI (voz/telefonía)"]
        YCloud["YCloud API (WhatsApp)"]
        TelegramAPI["Telegram Bot API"]
        Stripe["Stripe"]
        N8N["n8n — acciones por proyecto"]
    end

    ChatbotPublic --> ChatbotRespond --> AgentCore
    YCloudWebhook --> IdentityService --> AgentCore
    TelegramWebhook --> IdentityService
    RetellWS --> IdentityService
    RetellWS --> Whisper

    AgentCore --> Claude
    AgentCore --> ActionsService --> N8N
    AgentCore --> YCloud

    YCloudWebhook --> YCloud
    TelegramWebhook --> TelegramAPI
    RetellWS --> Retell

    IdentityService --> SupabaseCloud
    Backend --> SupabaseCloud
    StripeAPI --> Stripe

    Dashboard --> SupabaseCloud
    Conv --> Conversations
```

## 2. La pieza nueva: identidad omnicanal (no existe en v1)

```mermaid
graph LR
    subgraph Entrada["Un mismo cliente llega por..."]
        Web["Web: IP + visitor_id"]
        WA["WhatsApp: teléfono (alta confianza)"]
        TG["Telegram: user_id + username"]
        Voz["Voz: teléfono + call_id"]
    end

    Entrada --> Resolve["resolveCustomerIdentity()\nlib/customerIdentityService.js"]

    Resolve --> Identities[("customer_identities\n(normaliza tel/email/user_id,\nnivel de confianza high/medium/low)")]
    Resolve --> Customers[("customers\n(perfil unificado por proyecto)")]
    Resolve --> Conversations[("customer_conversations\n(1 por canal/hilo)")]
    Resolve --> Messages[("customer_messages\n(normalizados, todos los canales)")]
    Resolve --> Memory[("customer_memory\n(resumen compacto para no\ncargar todo el historial)")]
    Resolve -.->|"si hay coincidencia dudosa"| Merge[("customer_merge_suggestions")]
```

**Por qué importa:** en v1, cada canal guarda su propio rastro (`mensajes_wa`, `conversaciones_chat`) sin
enlazar "esta persona por WhatsApp" con "esta misma persona que llamó por teléfono". En v2, `resolveCustomerIdentity()`
unifica todo bajo un único `customer` por proyecto, con las tablas legacy (`proyectos`, `leads`, `mensajes_wa`,
`conversaciones_chat`) **coexistiendo** para compatibilidad.

## 3. Flujo de un mensaje entrante (igual que v1 + paso de identidad)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant CH as Canal (Web/WhatsApp/Telegram/Voz)
    participant R as Route (backend/routes/*)
    participant ID as customerIdentityService.js
    participant AC as agentCore.js
    participant DB as Supabase Cloud
    participant AI as Claude
    participant N8N as n8n

    U->>CH: mensaje
    CH->>R: webhook / POST / WS
    R->>ID: resolveCustomerIdentity(canal, hilo, identidades, traits)
    ID->>DB: buscar/crear customer + customer_identities + customer_conversations
    ID-->>R: {customer, conversation}
    R->>AC: runAgentLoop(proyecto, customer_memory, mensaje)
    AC->>DB: cargar customer_memory (más rápido que todo el historial)
    AC->>AI: prompt + tools
    AI-->>AC: texto o tool_use
    opt tool de acción (cita/pedido/stock/custom)
        AC->>N8N: callActionWebhook()
    end
    AC->>DB: guardar en customer_messages (+ legacy conversaciones_chat)
    AC-->>R: respuesta
    R-->>CH: responder (YCloud/Telegram/WS Retell)
    CH-->>U: respuesta
```

## 4. Índice de procesos → archivos

| Proceso de negocio | Dónde tocar |
|---|---|
| Resolución de identidad omnicanal (★ solo v2) | [`backend/lib/customerIdentityService.js`](backend/lib/customerIdentityService.js) |
| Esquema de identidad omnicanal (migración) | [`supabase/migrations/004_omnichannel_identity.sql`](supabase/migrations/004_omnichannel_identity.sql) |
| Lógica del agente / prompt / bucle de herramientas | [`backend/lib/agentCore.js`](backend/lib/agentCore.js) |
| Herramientas de acción (citas, pedidos, stock, custom) → n8n | [`backend/lib/actionsService.js`](backend/lib/actionsService.js) |
| Webhook WhatsApp (YCloud) | [`backend/routes/ycloudWebhook.js`](backend/routes/ycloudWebhook.js) |
| Webhook Telegram | [`backend/routes/telegramWebhook.js`](backend/routes/telegramWebhook.js) |
| Voz / teléfono (Retell Custom LLM WS) | [`backend/routes/retellWebhook.js`](backend/routes/retellWebhook.js) — prompt telefónico en `buildPhoneSystemPrompt()` |
| Widget web (autenticado / público) | [`backend/routes/chatbotRespond.js`](backend/routes/chatbotRespond.js), [`src/pages/ChatbotPublic.jsx`](src/pages/ChatbotPublic.jsx) |
| CRM de leads / conversaciones | [`backend/routes/leads.js`](backend/routes/leads.js), [`backend/routes/conversations.js`](backend/routes/conversations.js) |
| Pagos Stripe | [`backend/routes/stripe.js`](backend/routes/stripe.js) |
| Panel admin (`lmllamas@gmail.com` únicamente) | [`backend/routes/admin.js`](backend/routes/admin.js), [`src/pages/admin/*`](src/pages/admin/) |
| Configurar herramientas n8n por proyecto (UI) | [`src/components/admin/ToolsProjectSection.jsx`](src/components/admin/ToolsProjectSection.jsx) |
| Auth (frontend) | [`src/lib/AuthContext.jsx`](src/lib/AuthContext.jsx) |
| Despliegue | [`docker-compose.production.yml`](docker-compose.production.yml) en `/opt/genchats-v2` del VPS — servicios `api` (puerto 4002→4000) y `frontend` (puerto 8082→80, nginx) |

## 5. Despliegue (real, no confundir con `PROYECTO.md`)

```mermaid
graph LR
    subgraph VPS["/opt/genchats-v2 (VPS, docker-compose)"]
        API["contenedor genchats-v2-api\nbackend/Dockerfile · :4002→4000"]
        FE["contenedor genchats-v2-frontend\nDockerfile.frontend · nginx · :8082→80"]
    end
    FE -->|VITE_API_BASE_URL| API
    API --> CloudDB[("Supabase Cloud\n(propia, no la del VPS self-hosted)")]
```

Variables clave: `backend/.env.production` (Supabase Cloud, N8N_ACTIONS_WEBHOOK_URL, YCLOUD_API_KEY,
STRIPE_SECRET_KEY, ANTHROPIC_API_KEY) y `.env.production` del frontend (`VITE_API_BASE_URL` apuntando a `:4002`).

## 6. Tablas Supabase Cloud (propias de v2)

**Legacy (compatibilidad con v1):** `proyectos` · `leads` · `mensajes_wa` · `conversaciones_chat` · `config_plataforma` · `config_global` · `user_profiles` · `project_tools`

**Nuevas — identidad omnicanal:** `customers` · `customer_identities` · `customer_conversations` · `customer_messages` · `customer_memory` · `customer_merge_suggestions` · `customer_events` (aún sin uso activo)
