#!/bin/bash
# Auditoría SOLO LECTURA previa a promocionar el código v2 a producción v1 (genchats.app).
# No modifica nada: ni local, ni VPS, ni base de datos. Exit 0 = sin bloqueantes.
# Uso: bash .claude/skills/actualiza-genchats/audit.sh   (desde la raíz de genchats-v2)
set -u
VPS="root@72.62.24.150"
V1_DIR="$(cd "$(dirname "$0")/../../../.." && pwd)"       # repo v1 = padre de genchats-v2
V2_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"          # raíz de genchats-v2
V1_BACKEND_VPS="/etc/easypanel/projects/demo/genchats-api/code/backend"
fail=0; warn=0

echo "═══ actualiza-genchats · AUDITORÍA (solo lectura) · $(date '+%F %T') ═══"
echo "v1 (producción): $V1_DIR"
echo "v2 (fuente):     $V2_DIR"
echo

# ── 1. Estado git local ──────────────────────────────────────────────
echo "── 1. Git ──"
for repo in "$V1_DIR" "$V2_DIR"; do
  name=$(basename "$repo")
  git -C "$repo" fetch origin main --quiet 2>/dev/null
  dirty=$(git -C "$repo" status --porcelain | wc -l | tr -d ' ')
  behind=$(git -C "$repo" rev-list --count HEAD..origin/main 2>/dev/null || echo "?")
  echo "  $name: HEAD=$(git -C "$repo" log --oneline -1 | cut -c1-60) · sin commitear: $dirty · detrás de origin/main: $behind"
  [ "$behind" != "0" ] && [ "$behind" != "?" ] && { echo "  ⚠️  $name está DETRÁS de origin/main — desplegar así REVIERTE trabajo de otras sesiones"; warn=1; }
done
echo

# ── 2. Diff de código v2 → v1 (dry-run, nada se copia) ──────────────
echo "── 2. Ficheros que cambiarían al copiar v2 → repo v1 (rsync dry-run) ──"
# OJO: sin -c (checksum): en iCloud leería todo el árbol y dispara descargas de evictados.
rsync -rln --size-only --delete --out-format='%o %n' \
  --exclude .git --exclude .claude --exclude genchats-v2 --exclude 'node_modules*' \
  --exclude dist --exclude backups --exclude '.env*' --exclude CLAUDE.md --exclude '*.log' \
  --exclude GENCHATS_OPERATIVA_V1_V2.md --exclude .DS_Store --exclude scripts/deploy.sh \
  "$V2_DIR/" "$V1_DIR/" 2>/dev/null > /tmp/actualiza-genchats-diff.txt
# rsync local-a-local etiqueta las copias como 'recv' (no 'send')
n_send=$(grep -cE '^(send|recv)' /tmp/actualiza-genchats-diff.txt || true)
n_del=$(grep -c '^del\.' /tmp/actualiza-genchats-diff.txt || true)
echo "  cambiarían: $n_send ficheros · se borrarían en v1: $n_del (lista: /tmp/actualiza-genchats-diff.txt)"
grep '^del\.' /tmp/actualiza-genchats-diff.txt | head -15 | sed 's/^/    /'
echo

# ── 3. Salud de producción ───────────────────────────────────────────
echo "── 3. Salud producción ──"
for url in https://api.genchats.app/health https://api-v2.genchats.app/health; do
  r=$(curl -s -m 8 "$url")
  [[ "$r" == *'"ok":true'* ]] && echo "  ✅ $url → $r" || { echo "  ❌ $url → '$r'"; fail=1; }
done
code=$(curl -s -o /dev/null -w "%{http_code}" -m 8 https://genchats.app/)
[[ "$code" == "200" ]] && echo "  ✅ https://genchats.app → HTTP 200" || { echo "  ❌ https://genchats.app → HTTP $code"; fail=1; }
echo

# ── 4. VPS: PM2 + backups + claves .env que v2 necesita ─────────────
echo "── 4. VPS (solo lectura) ──"
# Claves que el CÓDIGO v2 realmente lee (derivado del código, no de ejemplos):
REQ_KEYS=$(grep -rhoE "process\.env\.[A-Z_0-9]+" "$V2_DIR/backend/server.js" \
  "$V2_DIR/backend/routes" "$V2_DIR/backend/lib" 2>/dev/null | sed 's/process\.env\.//' | sort -u)
ssh -o ConnectTimeout=10 "$VPS" "
  echo '  PM2:' \$(pm2 jlist 2>/dev/null | node -e 'const d=JSON.parse(require(\"fs\").readFileSync(0));for(const p of d)process.stdout.write(p.name+\"=\"+p.pm2_env.status+\" \")')
  echo '  Backups de deploy:' \$(ls /root/genchats-deploy-backups 2>/dev/null | tail -1) '(último)'
  cd $V1_BACKEND_VPS
  PRESENT=\$(grep -oE '^[A-Z0-9_]+' .env | sort -u)
  MISSING=''
  for k in $(echo $REQ_KEYS); do echo \"\$PRESENT\" | grep -qx \"\$k\" || MISSING=\"\$MISSING \$k\"; done
  if [ -n \"\$MISSING\" ]; then echo \"  ⚠️  Claves que v2 usa y FALTAN en .env de v1:\$MISSING\"; else echo '  ✅ .env de v1 tiene todas las claves que el código v2 lee'; fi
  echo \"  SUPABASE_URL de v1: \$(grep '^SUPABASE_URL' .env | cut -d= -f2)\"
" || { echo "  ❌ SSH al VPS falló"; fail=1; }
echo

# ── 5. Esquema: tablas y columnas que v2 requiere, contra la BD v1 ──
echo "── 5. Esquema BD v1 vs requisitos v2 (GET real limit 1, solo lectura) ──"
# Tablas: CREATE TABLE de schema + migraciones. Columnas: ALTER TABLE ... ADD COLUMN.
TABLES_DECL=$(grep -ihoE "create table (if not exists )?(public\.)?[a-z_]+" \
  "$V2_DIR"/supabase-schema.sql "$V2_DIR"/supabase-migrations/*.sql \
  "$V2_DIR"/supabase/migrations/*.sql 2>/dev/null | awk '{print $NF}' | sed 's/^public\.//' | sort -u)

# Solo se comprueban las tablas que el CÓDIGO usa de verdad. Hay tablas declaradas en
# migraciones antiguas que nadie referencia (p. ej. system_logs): si faltan en v1 no rompen
# nada, y marcarlas como bloqueante entrena a ignorar la auditoría. Las que no se usan se
# listan aparte como informativas.
TABLES=""; TABLES_SINUSO=""
for t in $TABLES_DECL; do
  if grep -rqE "from\('$t'\)|from\(\"$t\"\)|\.rpc\('$t" "$V2_DIR/backend" "$V2_DIR/src" 2>/dev/null \
     || grep -rq "'$t'" "$V2_DIR/backend/lib" "$V2_DIR/backend/routes" 2>/dev/null; then
    TABLES="$TABLES$t
"
  else
    TABLES_SINUSO="$TABLES_SINUSO $t"
  fi
done
[ -n "$TABLES_SINUSO" ] && echo "  (declaradas en migraciones pero sin uso en el código, no se comprueban:$TABLES_SINUSO)"
COLS=$(awk 'BEGIN{IGNORECASE=1} /alter table/{t=$0} /add column/{print t" "$0}' \
  "$V2_DIR"/supabase-migrations/*.sql "$V2_DIR"/supabase/migrations/*.sql 2>/dev/null \
  | grep -ioE "alter table (if exists )?(only )?(public\.)?[a-z_]+.*add column (if not exists )?[a-z_]+" \
  | sed -E 's/alter table (if exists )?(only )?(public\.)?//I; s/ *add column (if not exists )?/./I; s/ .*//' \
  | grep -E '^[a-z_]+\.[a-z_]+$' | sort -u)
PROBE_JS="
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tablas = process.argv[1].split(',').filter(Boolean);
const cols = process.argv[2].split(',').filter(Boolean);
let bad = 0;
// GET real con limit(1), NO select(...,{head:true}).
// El 2026-07-30 este chequeo dio un FALSO VERDE: con head:true supabase-js hace una peticion
// HEAD y no rellena el objeto error para una tabla inexistente, asi que la auditoria dijo que
// la BD v1 tenia todas las tablas cuando faltaban conversacion_notas, proyecto_operadores y
// user_profiles.tipo_cuenta. Un falso verde aqui es peor que no comprobar nada: se promociona
// codigo que usa tablas que no existen.
for (const t of tablas) {
  const { error } = await s.from(t).select('*').limit(1);
  if (error) { console.log('  ❌ FALTA tabla ' + t + '  (' + error.message.slice(0, 60) + ')'); bad++; }
}
for (const tc of cols) {
  const [t,c] = tc.split('.');
  const { error } = await s.from(t).select(c).limit(1);
  if (error) { console.log('  ❌ FALTA columna ' + tc + '  (' + error.message.slice(0, 60) + ')'); bad++; }
}
console.log(bad ? '  → ' + bad + ' gaps de esquema' : '  ✅ BD v1 tiene todas las tablas y columnas que v2 requiere');
process.exit(bad ? 1 : 0);
"
T_CSV=$(echo "$TABLES" | tr '\n' ',' ); C_CSV=$(echo "$COLS" | tr '\n' ',')
ssh -o ConnectTimeout=10 "$VPS" "cd $V1_BACKEND_VPS && node --input-type=module -e \"$PROBE_JS\" '$T_CSV' '$C_CSV'" || fail=1
echo

# ── 6. Fuga de datos: ¿alguna tabla sensible se lee SIN LOGIN? ────────
# El 2026-07-30 se descubrió que leads, mensajes_wa, conversaciones_chat, config_global y
# config_plataforma eran legibles con la clave anónima (que va en el bundle JS público):
# sus políticas eran `USING (true)` SIN `TO service_role`, lo que las abre a PUBLIC. Entre
# lo expuesto había datos personales (RGPD) y las claves de Stripe/YCloud. La auditoría no
# miraba las políticas en absoluto, así que esto pasó desapercibido durante meses.
echo "── 6. RLS: tablas sensibles legibles sin login (debe ser ninguna) ──"
SENSIBLES="leads mensajes_wa conversaciones_chat config_plataforma config_global customers customer_messages conversacion_notas proyecto_operadores reservas"
ANON=$(ssh -o ConnectTimeout=10 "$VPS" "grep -m1 '^SUPABASE_ANON_KEY=' $V1_BACKEND_VPS/.env | cut -d= -f2-" 2>/dev/null)
SB_URL=$(ssh -o ConnectTimeout=10 "$VPS" "grep -m1 '^SUPABASE_URL=' $V1_BACKEND_VPS/.env | cut -d= -f2-" 2>/dev/null)
if [ -z "$ANON" ] || [ -z "$SB_URL" ]; then
  echo "  ⚠️  no se pudo leer SUPABASE_ANON_KEY/URL — comprobación omitida"; warn=1
else
  leaks=0
  for t in $SENSIBLES; do
    r=$(curl -s -m 10 "$SB_URL/rest/v1/$t?select=*&limit=1" -H "apikey: $ANON")
    # '[]' = RLS filtra todo (o tabla vacía); un JSON con "message" = error/bloqueada.
    # Cualquier otra cosa son FILAS REALES devueltas sin autenticar.
    if [ "$r" != "[]" ] && ! printf '%s' "$r" | grep -q '"message"'; then
      echo "  ❌ FUGA: $t devuelve datos sin autenticar"; leaks=$((leaks+1)); fail=1
    fi
  done
  [ $leaks -eq 0 ] && echo "  ✅ ninguna tabla sensible responde sin login"
fi
echo

echo "═══ Resultado: $([ $fail -eq 0 ] && echo 'SIN BLOQUEANTES' || echo 'HAY BLOQUEANTES ❌') $([ $warn -eq 1 ] && echo '· con avisos ⚠️') ═══"
echo "Siguiente paso: revisar informe y confirmar bloque a bloque (ver SKILL.md §Aplicar)."
exit $fail
