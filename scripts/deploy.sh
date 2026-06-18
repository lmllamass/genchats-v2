#!/bin/bash
set -e
VPS="root@72.62.24.150"

echo "━━━ DESPLEGANDO FRONTEND ━━━"
npm run build
tar czf /tmp/genchats-dist.tar.gz dist/
scp /tmp/genchats-dist.tar.gz $VPS:/tmp/
ssh $VPS 'CONTAINER=$(docker ps --filter "name=demo_genchats-frontend" --format "{{.ID}}" | head -1) && docker cp /tmp/genchats-dist.tar.gz $CONTAINER:/tmp/ && docker exec $CONTAINER sh -c "rm -rf /usr/share/nginx/html/* && tar xzf /tmp/genchats-dist.tar.gz -C /usr/share/nginx/html --strip-components=1 && nginx -s reload" && echo FRONTEND OK'
echo "✅ Frontend desplegado — verifica en https://genchats.app"
