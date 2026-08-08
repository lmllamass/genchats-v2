# Migraciones pendientes · 8 de agosto de 2026

Un fichero por entorno, para pegar de una vez en el editor SQL de Supabase.
Los dos son **reejecutables**: si algo ya estuviera, no dan error.

## v2 — `v2_al_dia_2026-08-08.sql`

Editor SQL: <https://supabase.com/dashboard/project/trpqxsdsoydivdgrofaf/sql/new>

```
pbcopy < docs/migraciones/v2_al_dia_2026-08-08.sql
```

Solo la **025** (aforo por sede): la 024 ya está aplicada.
Hasta pasarla, crear o editar una sede da error; el resto funciona.

## v1 — `v1_al_dia_2026-08-08.sql`

Editor SQL: <https://supabase.com/dashboard/project/plsxmckjdxepawajjthc/sql/new>

```
pbcopy < docs/migraciones/v1_al_dia_2026-08-08.sql
```

Reúne **023 + 024 + 025**, en ese orden. Es lo único que le falta a v1:
comprobado columna a columna contra su esquema real (las 111 que lee el código
de v2). La identidad omnicanal, `project_tools` y el motor de reservas ya los
tiene, así que el catálogo de sedes y el aviso de privacidad funcionarán sin
tocar nada más.

**No altera el funcionamiento actual de v1.** Solo añade columnas nuevas (que
quedan a NULL), tablas nuevas y un bucket; nada existente cambia de forma. Se
puede pasar hoy y desplegar el código cuando se decida.

### Si falla el último bloque

El `INSERT INTO storage.buckets` puede dar error de permisos sobre el esquema
`storage`. En ese caso crea el bucket a mano —**Storage → New bucket**, nombre
`archivos`, **sin marcar público**— y listo: el resto ya habrá quedado aplicado.

### Antes de desplegar el código de v2 en v1

Añadir al `.env` del backend:

```
DOCS_WEBHOOK_SECRET=...          # openssl rand -hex 32
DOCS_PUBLIC_URL=https://api.genchats.app
```

Sin ellas el portal de archivos arranca pero no emite enlaces.

## Comprobado

Los dos ficheros se han ejecutado contra un PostgreSQL con una réplica del
esquema real de v1: dos pasadas seguidas sin errores, 2 tablas nuevas,
3 columnas nuevas, 4 funciones y el bucket privado.
