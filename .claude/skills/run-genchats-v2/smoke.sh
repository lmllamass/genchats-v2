#!/bin/bash
# Smoke test de genchats-v2 en local: frontend (Vite :5173) + backend (Express).
# Uso: ./smoke.sh [dir-de-salida-para-screenshot]
# Requiere ambos servidores ya arrancados (ver SKILL.md). Exit 0 = todo OK.
set -u
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
BACKEND_URL="${BACKEND_URL:-http://localhost:4001}"
OUT_DIR="${1:-${TMPDIR:-/tmp}}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fail=0

check() { # check <nombre> <comando...>
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then echo "✅ $name"; else echo "❌ $name"; fail=1; fi
}

# 1. Backend /health responde {"ok":true}
health=$(curl -s -m 5 "$BACKEND_URL/health")
if [[ "$health" == *'"ok":true'* ]]; then echo "✅ backend /health → $health"
else echo "❌ backend /health → '$health'"; fail=1; fi

# 2. Frontend devuelve 200
code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 "$FRONTEND_URL/")
if [[ "$code" == "200" ]]; then echo "✅ frontend HTTP $code"
else echo "❌ frontend HTTP $code"; fail=1; fi

# 3. React renderiza de verdad (dump-dom tras ejecutar JS) — detecta pantalla en blanco
dom=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=8000 \
      --dump-dom "$FRONTEND_URL/" 2>/dev/null)
if [[ "$dom" == *"GenChats"* ]]; then echo "✅ React renderiza (marca 'GenChats' en el DOM)"
else echo "❌ DOM sin contenido React — pantalla en blanco"; fail=1; fi

# 4. Screenshot en disco
shot="$OUT_DIR/genchats-v2-home.png"
"$CHROME" --headless=new --disable-gpu --window-size=1280,900 \
  --virtual-time-budget=10000 --screenshot="$shot" "$FRONTEND_URL/" >/dev/null 2>&1
if [[ -s "$shot" ]]; then echo "✅ screenshot → $shot"
else echo "❌ screenshot no generado"; fail=1; fi

exit $fail
