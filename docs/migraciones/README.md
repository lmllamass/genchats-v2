# Migraciones pendientes · 8 de agosto de 2026

Un fichero por entorno, para pegar de una vez en el editor SQL de Supabase.
Los dos son **reejecutables**: si algo ya estuviera, no dan error.

## v2 — `v2_al_dia_2026-08-08.sql`

Editor SQL: <https://supabase.com/dashboard/project/trpqxsdsoydivdgrofaf/sql/new>

```
pbcopy < docs/migraciones/v2_al_dia_2026-08-08.sql
```

Reúne **023 + 025**. La 024 ya estaba aplicada, y la 025 se pasó el 8 de agosto;
queda la **023** (`proyectos.retell_api_key`), que nunca llegó a v2. Hoy no
estorba —Retell funciona igual— pero la sección de Retell del admin falla al
leer esa columna.

Volver a pasar la 025 no hace nada: es reejecutable.

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
esquema real: dos pasadas seguidas sin errores en ambos.

**Estado el 8 de agosto**, comparando las dos bases columna a columna (125
columnas, las que el código lee más lo que crean las migraciones):

- **v1: al día.** Las tres migraciones dentro, incluidas las funciones y el bucket.
- **v2: falta `proyectos.retell_api_key`.** Es la única diferencia entre las dos
  bases, y es lo que arregla el fichero de v2.
