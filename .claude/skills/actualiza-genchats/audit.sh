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
echo "── 5. Esquema BD v1 vs requisitos v2 (probes select limit 0, solo lectura) ──"
# Tablas: CREATE TABLE de schema + migraciones. Columnas: ALTER TABLE ... ADD COLUMN.
TABLES=$(grep -ihoE "create table (if not exists )?(public\.)?[a-z_]+" \
  "$V2_DIR"/supabase-schema.sql "$V2_DIR"/supabase-migrations/*.sql \
  "$V2_DIR"/supabase/migrations/*.sql 2>/dev/null | awk '{print $NF}' | sed 's/^public\.//' | sort -u)
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
for (const t of tablas) {
  const { error } = await s.from(t).select('*',{head:true}).limit(0);
  if (error) { console.log('  ❌ FALTA tabla ' + t); bad++; }
}
for (const tc of cols) {
  const [t,c] = tc.split('.');
  const { error } = await s.from(t).select(c,{head:true}).limit(0);
  if (error) { console.log('  ❌ FALTA columna ' + tc + '  (' + error.message + ')'); bad++; }
}
console.log(bad ? '  → ' + bad + ' gaps de esquema' : '  ✅ BD v1 tiene todas las tablas y columnas que v2 requiere');
process.exit(bad ? 1 : 0);
"
T_CSV=$(echo "$TABLES" | tr '\n' ',' ); C_CSV=$(echo "$COLS" | tr '\n' ',')
ssh -o ConnectTimeout=10 "$VPS" "cd $V1_BACKEND_VPS && node --input-type=module -e \"$PROBE_JS\" '$T_CSV' '$C_CSV'" || fail=1
echo
echo "═══ Resultado: $([ $fail -eq 0 ] && echo 'SIN BLOQUEANTES' || echo 'HAY BLOQUEANTES ❌') $([ $warn -eq 1 ] && echo '· con avisos ⚠️') ═══"
echo "Siguiente paso: revisar informe y confirmar bloque a bloque (ver SKILL.md §Aplicar)."
exit $fail
