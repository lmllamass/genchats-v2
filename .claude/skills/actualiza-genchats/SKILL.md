---
name: actualiza-genchats
description: Promocionar el código de v2 a producción v1 (genchats.app) sin romper nada para los tenants. Audita sistemas (BD Supabase, env, salud, git), pide confirmación y aplica por bloques. Usar cuando se pida actualizar genchats, promocionar v2 a producción, pasar v2 a v1, o desplegar la última versión a genchats.app.
---

# actualiza-genchats — promocionar v2 → producción v1

Producción real (clientes/tenants) es **v1**: `https://genchats.app` + `https://api.genchats.app`
(PM2 `genchats-backend` en el host del VPS + nginx swarm). El desarrollo vive en **v2**
(`genchats-v2/`, este repo). Esta skill actualiza producción para que ejecute el código de v2
**manteniendo la Supabase de v1** (`plsxmckjdxepawajjthc`) — decisión del 2026-07-28: los tenants
conservan sus logins y datos vivos, y el esquema se completa de forma aditiva si falta algo.

Rutas relativas a la raíz de `genchats-v2/`. Repo v1 = directorio padre (`../`).
Modo obligatorio: **auditar → informar → confirmar → aplicar por bloques**. Nunca aplicar sin
confirmación explícita del usuario que nombre el sistema y la acción (el clasificador del harness
además bloquea SSH/escrituras a producción sin esa confirmación literal).

## Fase 1 — Auditoría (solo lectura, siempre primero)

```bash
bash .claude/skills/actualiza-genchats/audit.sh
```

Comprueba sin tocar nada: **que esta copia de la skill no sea la vieja** (paso 0);
estado git de ambos repos (y si están detrás de origin — desplegar
detrás de origin **revierte trabajo de sesiones paralelas**, ya ha pasado); dry-run del rsync
v2→v1 (nº de ficheros, lista en `/tmp/actualiza-genchats-diff.txt`); salud de
`api.genchats.app`, `api-v2` y frontal; PM2 y último backup en el VPS; claves de `.env` que el
código v2 lee y faltan en el `.env` de v1; que la BD v1 tenga las tablas/columnas que el código
de v2 usa de verdad (probes `select … limit 1` con las credenciales del propio proceso v1); y
que ninguna tabla sensible responda a la clave anónima (fuga de datos).

**☠️ El chequeo de esquema daba FALSOS VERDES hasta el 2026-07-30.** Usaba
`select('*', {head:true})`: con `head:true` supabase-js hace una petición HEAD y **no rellena
`error` para una tabla inexistente**, así que la auditoría afirmaba "BD v1 tiene todas las
tablas" mientras faltaban `conversacion_notas`, `proyecto_operadores` y
`user_profiles.tipo_cuenta`. Se promocionó código que las usaba y falló en producción. Ya
corregido a `select(...).limit(1)`. Si alguna vez se toca ese probe: **nunca `head:true`**.

El paso 5 solo comprueba tablas **referenciadas por el código**; las declaradas en migraciones
antiguas que nadie usa (`system_logs`, `customer_events`, `reservas_cierres`) se listan como
informativas y no bloquean — si faltan en v1 no rompen nada.

El paso 7 (nuevo el 2026-08-08) mira lo que el resto de pasos daban por hecho: que exista
una **copia de los datos de v1 con `CONTEXTOS.json`**, que `demo_genchats-api` siga parado y
que `api.genchats.app` siga apuntando al PM2 del host y no a un contenedor.

El paso 6 (nuevo el 2026-07-30) detecta la clase de fallo que dejó **datos personales y las
claves de Stripe/YCloud legibles sin login durante meses**: políticas escritas
`USING (true)` **sin `TO service_role`**, que en PostgreSQL aplican a PUBLIC (incluido `anon`,
cuya clave va en el bundle JS). Ver [[project_genchats_claves_expuestas_pendiente_rotar]].

Estado verificado el 2026-07-30 (tras promocionar): esquema alineado, sin fugas, 4 claves de
env ausentes en v1 pero también ausentes en v2 (no-op documentado más abajo).

## Fase 2 — Informe y confirmación

Presentar al usuario: gaps de esquema, claves faltantes, nº de ficheros, avisos de git. Pedir
confirmación **por bloque** (BD / env / código+deploy). No continuar con un bloque sin su OK.

## Fase 3 — Aplicar (cada bloque con confirmación previa)

**Bloque A — Esquema BD (solo si la auditoría marcó gaps).** Aplicar en la Supabase de v1
(`plsxmck…`, SQL editor del dashboard o `scripts/db-tunnel.sh` del repo v1) únicamente los
statements **aditivos** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) de
`supabase-schema.sql`, `supabase-migrations/*.sql` y `supabase/migrations/*.sql` que cubran el
gap. Nunca `DROP`/`ALTER … TYPE` sin plan de reversa. Revisar también constraints de `plan` y
`canal` (gaps históricos, ver GENCHATS_OPERATIVA_V1_V2.md §8.4).

**Bloque B — Claves .env del backend v1 en el VPS.** Añadir al final de
`/etc/easypanel/projects/demo/genchats-api/code/backend/.env` las claves que falten. Los valores
reales están en el env del contenedor v2: `ssh root@72.62.24.150 "docker exec genchats-v2-api env | grep -E '^(GOOGLE_CALENDAR_SA_KEY|N8N_|ADMIN_)'"`.
**Prohibido tocar `SUPABASE_URL` / `SUPABASE_*` de v1** — es la línea que separa "actualizar" de
"romper producción". El restart lo hará el deploy del bloque C (`--update-env`).

**Bloque C — Copiar código y desplegar.**

> ☠️ **Antes de nada, mirar el paso 2 de la auditoría.** El rsync de abajo es un ESPEJO
> (`--delete`) y solo vale si v1 ⊆ v2. El 2026-08-08 dejó de ser cierto: v1 tenía 27 ficheros
> propios (las 7 landings de SEO, `robots.txt`, `sitemap.xml`, `llms.txt`, `og-image.png`,
> `logo.png`, `NoIndex.jsx`, `ChannelLandingLayout.jsx`) y 26 ficheros tocados por los dos
> lados. Espejar habría borrado toda la fase de SEO y las cabeceras de seguridad de nginx.
> **Si el paso 2 marca borrados o conflictos, no se espeja: se fusiona fichero a fichero.**

Desde la raíz de `genchats-v2`:

```bash
# 1. Copia real (mismo rsync de la auditoría, sin -n). Exclusiones OBLIGATORIAS:
#    genchats-v2 (¡este repo vive DENTRO de v1!), .git, .claude, node_modules*, dist,
#    backups, .env*, CLAUDE.md, GENCHATS_OPERATIVA_V1_V2.md
rsync -rl --size-only --delete \
  --exclude .git --exclude .claude --exclude genchats-v2 --exclude 'node_modules*' \
  --exclude dist --exclude backups --exclude '.env*' --exclude CLAUDE.md \
  --exclude '*.log' --exclude GENCHATS_OPERATIVA_V1_V2.md --exclude .DS_Store \
  --exclude scripts/deploy.sh \
  ./ ../

# 2. Deps del frontend v1 y deploy con el deployer canónico de v1.
#    npm install, NUNCA npm ci: ci borra node_modules y DESTRUYE el symlink .nosync
#    (y aun así npm install puede cargárselo — verificar y recolocar después, ver Gotchas)
cd .. && npm install --no-audit --no-fund
ls -la node_modules | head -1   # si ya no es symlink → mv node_modules node_modules.nosync + ln -s
./scripts/deploy.sh backend     # backup en VPS + node --check + npm install si toca + pm2 restart + health
./scripts/deploy.sh frontend    # npm run build (usa .env.production de v1 → BD y API de v1) + docker cp + nginx reload
```

`deploy.sh` ya valida sintaxis, hace backup en `/root/genchats-deploy-backups/<fecha>` y reintenta
`/health`. El build del frontend usa el `.env.production` del repo v1 (verificado: tiene
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, `VITE_GENA_PROYECTO_ID`) — así el
frontal sigue apuntando a la BD y API de v1.

**Bloque D — Persistir.** Los deploys son overlays efímeros: en el repo v1,
`git add -A && git commit` (mensaje: "promote: código v2 <hash-v2> a producción") y
`git push origin main`. Anotar el hash de v2 promocionado.

## Fase 4 — Smoke post-deploy

```bash
curl -s https://api.genchats.app/health          # {"ok":true,...}
curl -s -o /dev/null -w "%{http_code}\n" https://genchats.app/   # 200
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --virtual-time-budget=8000 --dump-dom https://genchats.app/ | grep -c GenChats  # >0
ssh root@72.62.24.150 "pm2 logs genchats-backend --err --lines 30 --nostream"    # sin errores nuevos
```

Además: abrir genchats.app, login real y enviar un mensaje al chatbot de un proyecto de prueba
(web embed) — es el smoke que de verdad cubre agentCore + BD.

**Rollback:** backend → `ssh root@72.62.24.150` y restaurar `routes/ lib/ server.js` desde
`/root/genchats-deploy-backups/<fecha>` + `pm2 restart genchats-backend`; frontend → en el repo
v1 `git checkout <commit-anterior> && ./scripts/deploy.sh frontend`.

## Gotchas

- **☠️ v1 y v2 son repos SEPARADOS que divergen.** Dos `.git` distintos (`genchats/.git` y
  `genchats-v2/.git`), sin remoto común: nada impide que v1 reciba trabajo que v2 nunca ve. Ha
  pasado con toda la fase de SEO (landings por canal, robots/sitemap/llms, CSP y HSTS en
  `nginx.conf`, metadatos en `index.html`, `react-helmet-async` en `package.json`) y con los
  endpoints `GET/PUT /api/admin/config-global` de `backend/routes/admin.js`. El historial lo
  delata: los commits `promote:` dicen "fusionado", no "copiado". **Promocionar es fusionar.**
- **☠️ El contador de borrados del paso 2 mentía.** Usaba `--out-format='%o %n'` y buscaba el
  prefijo `del.`, que solo emite rsync 3.x; el de macOS no lo emite nunca, así que el informe
  decía "0 borrados" con 27 borrados reales pendientes. Ahora usa `-v` y parsea `deleting `.
  Moraleja para cualquier contador de esta skill: **un cero hay que verlo salir de un caso que
  de verdad tenga elementos**, no darlo por bueno porque no falló.
- **☠️ Hay DOS copias de esta skill y pueden divergir** (2026-08-08): la de `genchats-v2/`
  tenía fecha más reciente y contenido más viejo — le faltaban los arreglos del 30-jul, entre
  ellos el probe con `limit(1)` que sustituyó al `head:true` de los falsos verdes. Ejecutarla
  habría dado "todo bien" sin comprobar nada. **La fecha no decide cuál es buena.** El paso 0
  lo detecta; ante divergencia, comparar contenido y sincronizar antes de auditar. El script
  calcula sus rutas desde su ubicación, así que **solo funciona la copia de `genchats-v2/`**:
  hay que sincronizarla, no ejecutar la otra.
- **☠️ Lo que un despliegue no puede reconstruir son los contextos del cliente.** El backend
  nunca escribe en `chatbot_config` (solo lee) y el editor guarda el objeto completo, así que
  las claves que el panel no muestra sobreviven. Pero **`generarChatbot` sí lo rehace entero**
  rascando la web, y se dispara al guardar en la pestaña **Tienda** si cambió el interruptor
  de ecommerce o la plataforma. En FADECOM son 19.226 caracteres escritos por el cliente. El
  paso 7 exige copia previa; el fichero `CONTEXTOS.json` de esa copia es el que permite
  restaurar solo eso sin tocar nada más.
- **El app `genchats-api` de Easypanel no tiene imagen propia** (el backend vive en PM2 del
  host) y el 2026-07-23 a las 16:54:30 acabó ejecutando la imagen del **frontend**, junto con
  `demo_genchats-frontend`, en el mismo milisegundo. Un contenedor llamado "api" sirviendo HTML
  confunde a quien vaya a desplegar. Está escalado a 0. **No borrar el app**: es quien crea el
  router de `api.genchats.app` (que apunta a `172.17.0.1:4000`, o sea al host). El arreglo
  definitivo es sacar esa ruta a un fichero propio de Traefik —como `genchats-v2.yaml`— y
  entonces sí borrarlo; hacerlo justo antes de promocionar mezcla dos cambios y no conviene.
- **☠️ `--exclude scripts/deploy.sh` en el rsync es OBLIGATORIO** (aprendido el 2026-07-28 en
  la primera promoción): sin él, el `deploy.sh` de v2 (resto solo-frontend que ignora el
  argumento `backend`) PISA el deployer canónico de v1 — el "deploy backend" desplegó el
  frontend y dejó producción mixta (front v2 + API vieja) hasta restaurarlo con
  `git checkout -- scripts/deploy.sh` en el repo v1 y repetir el deploy.
- **☠️ NO ejecutar `genchats-v2/scripts/deploy.sh`** (el de ESTE repo): es un resto de la copia
  que apunta al contenedor de **v1** (`demo_genchats-frontend`) — lanzarlo despliega la build de
  v2 (con envs de v2 → BD de v2) sobre genchats.app, exactamente el desastre que esta skill
  evita. El deploy correcto es SIEMPRE `../scripts/deploy.sh` desde el repo v1, tras el rsync.
- **npm ci/install destruyen el symlink `node_modules → node_modules.nosync`** (npm borra el
  symlink y crea un dir real dentro de iCloud → futura eviction). Tras CUALQUIER npm
  install/ci en raíz o backend de cualquiera de los dos repos: verificar con
  `ls -la | grep node_modules` y recolocar (`mv node_modules node_modules.nosync` — apartando
  antes el nosync viejo — `+ ln -s`).
- **Antes de `git add -A` en el repo v1, asegurar que `.gitignore` cubre `node_modules*`**
  (todas las variantes: `.nosync`, `.old-*`, `node_modules 2`). El 2026-07-28 un add sin eso
  metió 28.075 ficheros de node_modules en el índice: git quedó lentísimo (objetos sueltos en
  `.git/objects` + iCloud sincronizándolos), con index.lock huérfanos. Recuperación: apartar
  `index.lock` (mv, no rm), `git read-tree HEAD` (resetea índice sin tocar disco) y re-add.
- **El aviso de claves .env de la auditoría es informativo, no bloqueante**: comparar SIEMPRE
  contra el env real del contenedor v2 (`docker exec genchats-v2-api env`) — el 2026-07-28 las
  4 "faltantes" (`GOOGLE_CALENDAR_SA_KEY`, `N8N_WEBHOOK_TOKEN`, `ADMIN_*`) tampoco existían en
  v2 producción (las ADMIN_* tienen fallback `info@konkabeza.es` en código) → paridad = no-op.
  `GOOGLE_CALENDAR_SA_KEY` sigue pendiente EN AMBAS producciones (Calendar inactivo).
- **`genchats-v2/` vive DENTRO del repo v1.** Sin `--exclude genchats-v2` el rsync se copia a sí
  mismo dentro de sí mismo. Es la exclusión más importante de la lista.
- **La BD de producción v1 es Supabase CLOUD** (`plsxmck…`), no el contenedor
  `demo_supabase-db-1` del VPS (copia muerta de mayo/junio). Y la BD de v2 (`trpqx…`) tiene datos
  **divergidos desde el 2026-07-09** — no re-migrar ni repuntar sin decisión explícita.
- **rsync sin `-c` a propósito**: con checksum lee todo el árbol y en iCloud dispara descargas de
  ficheros evictados (se queda colgado). `--size-only`/quick-check basta aquí.
- **grep de claves .env con `[A-Z0-9_]`**: con `[A-Z_]` los nombres con dígitos se truncan
  (`N8N_…`→`N`, `AWS_S3…`→`AWS_S`) y el diff de claves miente.
- **v1 tiene claves extra** (TWILIO, VAPI, ELEVEN_LABS, AWS, REDIS…) que v2 no lee — dejarlas.
- **`src` de v2 referencia `VITE_BASE44_*` y `VITE_APP_URL`** (legacy base44) que no están en el
  `.env.production` de v1 — no bloquean el build; ignorar salvo que el build falle por ellas.
- **Sesiones paralelas** (Codex u otras) tocan estos repos a la vez: `git fetch` + revisar
  divergencia SIEMPRE antes de copiar o desplegar. La auditoría lo chequea.

## Troubleshooting

| Síntoma | Causa → arreglo |
|---|---|
| Auditoría colgada en el paso 2 | rsync con `-c` o iCloud evictado → usar el audit.sh actual (sin `-c`) |
| Dry-run dice "0 ficheros" con cambios evidentes | rsync local-a-local etiqueta `recv`, no `send` (ya corregido en audit.sh) |
| `/health` no responde tras deploy | `pm2 logs genchats-backend --err` — típico `ERR_MODULE_NOT_FOUND` si npm install no corrió; deploy.sh lo cubre si package.json cambió |
| El agente responde pero sin calendario/n8n | Faltan `GOOGLE_CALENDAR_SA_KEY` / `N8N_WEBHOOK_TOKEN` en el `.env` de v1 (Bloque B) |
