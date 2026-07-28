---
name: run-genchats-v2
description: Arrancar, probar y capturar screenshots de genchats-v2 en local (frontend Vite + backend Express). Usar cuando se pida run, start, lanzar, levantar, probar en local o screenshot de la app v2.
---

# Run genchats-v2 (local)

Dos servidores: frontend React/Vite (`src/`, puerto 5173) y backend Express (`backend/`, puerto
4000 por defecto — usa 4001 en local para no chocar con otros procesos). Todas las rutas de este
documento son relativas a la raíz de `genchats-v2/`. El harness del agente es
`.claude/skills/run-genchats-v2/smoke.sh` (curl + Chrome headless, deja screenshot en disco).

## Prerrequisitos

Ya presentes en este Mac: Node ≥20 (`/usr/local/bin/node`), Google Chrome instalado, deps ya
instaladas. `node_modules` es **symlink a `node_modules.nosync`** en la raíz Y en `backend/`
(imprescindible en iCloud Drive, ver Gotchas). Si falta alguna dep:

```bash
npm ci --no-audit --no-fund            # raíz (frontend)
cd backend && npm ci --no-audit --no-fund
```

## Run (ruta del agente)

Lanzar los dos servidores en background (tool Bash con `run_in_background: true` — **no** usar
`comando &` dentro del sandbox, el bind del puerto se bloquea y el proceso queda colgado):

```bash
# Frontend — no necesita .env (fallbacks hardcodeados, ver Gotchas)
npm run dev            # → http://localhost:5173

# Backend — arranca con env dummy si solo quieres humo/salud (desde backend/)
SUPABASE_URL=https://dummy.supabase.co SUPABASE_SERVICE_ROLE_KEY=dummy PORT=4001 node server.js
# listo cuando loguea: "✅ pagegen-api running on port 4001"
```

Verificar todo + screenshot en disco:

```bash
bash .claude/skills/run-genchats-v2/smoke.sh /ruta/salida   # exit 0 = OK
```

Comprueba: `GET :4001/health` → `{"ok":true}`, frontend HTTP 200, que React renderiza de verdad
(marca `GenChats` en el `--dump-dom`, detecta pantalla en blanco) y deja
`genchats-v2-home.png` (landing oscura "Tu negocio responde solo. 24/7.").

Para interacción más profunda (clicks, formularios) usar las tools `claude-in-chrome` contra
`http://localhost:5173`, o Chrome headless con `--dump-dom` para asserts sobre el DOM.

## Run (ruta humana)

`npm run dev` en la raíz y `npm run dev` en `backend/` (usa `node --watch`), abrir
`http://localhost:5173`. Ctrl-C para parar.

## Test / lint

No hay suite de tests. Sí hay:

```bash
npm run lint        # eslint --quiet
npm run build       # vite build → dist/ (verificación real de que el frontend compila)
```

## Gotchas

- **iCloud Drive evicta `node_modules` y cuelga Node sin error**: el repo vive en
  `com~apple~CloudDocs`. Si `node_modules` no es symlink a `*.nosync`, iCloud evicta los
  ficheros y `node server.js` se queda **colgado para siempre en un `read()` síncrono**
  (0% CPU, sin log, sin bind del puerto — parece un bug del server y no lo es). Diagnóstico:
  `du -sh backend/node_modules` → si da ~72K con 150 paquetes, está evictado. Arreglo:
  `mv node_modules node_modules.old && mkdir node_modules.nosync && ln -s node_modules.nosync node_modules && npm ci`.
- **El frontend sin `.env.local` apunta a PRODUCCIÓN**: `src/api/supabaseClient.js` tiene
  fallback hardcodeado al Supabase de **v1** (`plsxmckjdxepawajjthc`) y `src/api/backendApi.js`
  a `https://api-v2.genchats.app`. Cargar la landing es inocuo, pero **hacer login o mutaciones
  en local sin `.env.local` toca datos reales**. Para aislar: `cp .env.frontend.example .env.local`
  y rellenar con el proyecto Supabase de v2.
- **El backend arranca con env dummy** (health, rutas montadas, WebSocket Retell) pero cualquier
  ruta que toque Supabase/Anthropic/YCloud fallará en runtime. Env real: `backend/.env`
  (no existe en local; las claves reales están en el VPS — ver GENCHATS_OPERATIVA_V1_V2.md §3).
- **Puerto**: el backend usa `PORT` (default 4000). En producción v2 el contenedor expone 4002→4000.
- **Los `&` en Bash sandboxeado no sirven para servidores**: el proceso sobrevive pero no puede
  hacer bind del puerto. Usar el background del tool Bash.

## Troubleshooting

| Síntoma | Causa → arreglo |
|---|---|
| `node server.js` vivo pero `:4001` rechaza conexión y log vacío | `node_modules` evictado por iCloud → symlink `.nosync` + `npm ci` (ver Gotchas) |
| `curl /health` connection refused recién lanzado | Aún importando deps; espera 2-4s tras "running on port" |
| Screenshot en blanco | Falta `--virtual-time-budget=8000` (React no ejecutó aún) |
