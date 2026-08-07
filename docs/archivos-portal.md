# Zona de cargas y descargas (`/p/:token`)

Un mini-portal por contacto: el tenant le deja archivos (presupuestos, facturas,
diplomas) y el cliente final sube los suyos (DNI, documentación, fotos).

Como los contactos ya están unificados por la identidad omnicanal (migración
004), **el archivo cuelga del contacto, no del canal**: un PDF subido por el
portal aparece en la misma ficha que sus WhatsApps.

## Por qué no se usa Dropbox

Se empezó apoyándose en los *file request* de Dropbox y no valían:

- La credencial de n8n **no puede pedir el scope `file_requests.write`** (n8n
  cablea sus scopes), así que el enlace había que crearlo a mano y era el mismo
  para todos.
- No había acuse de recibo: aunque el cliente subiera las fotos, nadie se
  enteraba.
- Dependía de que cada cliente nos diera credenciales de su Dropbox.

Con Supabase Storage desaparecen las tres cosas y no hace falta infraestructura
nueva.

## Piezas

| | |
|---|---|
| `supabase-migrations/024_archivos_contacto.sql` | tablas `archivos` y `archivo_enlaces`, cuota por plan, bucket privado |
| `backend/lib/archivoEnlaces.js` | crear, resolver y revocar magic links |
| `backend/routes/archivos.js` | API del enlace + portal que ve el contacto |
| `backend/routes/archivosContacto.js` | lado tenant, bajo `/api/conversations/:id/archivos` |
| `src/components/editor/ConversacionArchivos.jsx` | pestaña Archivos de la ficha |

## Los magic links

El cliente final no tiene cuenta y no debe tenerla: crear usuarios para los
clientes de nuestros clientes mata la adopción.

En la base vive **solo el `sha256` del token**, nunca el token — que existe
únicamente dentro de la URL que recibe el contacto, igual que un reset de
contraseña. Se guarda en tabla (y no autofirmado) porque revocar exige estado; y
habiendo tabla, firmar ya no aporta nada.

Caducado, revocado e inexistente devuelven lo mismo: al visitante nunca se le
dice cuál de las tres cosas es.

Los `slots` (qué se le pide subir) se **congelan al crear el enlace**: si el
proyecto cambia después los documentos que exige, el enlace ya enviado sigue
pidiendo lo que le dijimos al contacto.

## Seguridad de las descargas

El bucket es privado y **sin políticas para `anon`**: nadie llega a un objeto por
su cuenta. El backend firma URLs de 5 minutos, siempre con
`Content-Disposition: attachment` vía la opción `download`.

Esto no es cosmético: un contacto puede subir un HTML o un SVG con script, y
servirlo con su propio `Content-Type` sería **XSS en nuestro dominio con la
sesión del tenant abierta**. Bloquear ejecutables no basta, porque el vector es
el HTML.

Además, por el portal solo se ofrecen para descarga los archivos con
`origen = 'tenant'`: lo que subió el propio contacto, o lo que llegó por otros
canales, no se le devuelve.

## Cuotas

`user_profiles.bytes_almacenados` es un contador mantenido por trigger, no un
`SUM()` en cada subida — con unos miles de ficheros por cuenta, sumar sale caro.
Free 100 MB · pro 2 GB · super pro 10 GB, y 25 MB por objeto.

Al alta, la fila de `archivos` se inserta **antes** de subir a Storage: es la que
dispara el trigger de cuota. Al revés quedaría el objeto subido y huérfano
cuando el plan está lleno. Si el plan no da, el portal responde 507.

## Configuración por proyecto

En `project_tools`, fila `tool_name = 'archivos'` (opcional; hay valores por
defecto):

```json
{
  "slots": [
    { "id": "dni_anverso", "titulo": "DNI o NIE — parte delantera", "ayuda": "..." }
  ],
  "webhook_confirmacion": "https://.../webhook/archivos-recibidos",
  "dias_validez": 7,
  "aviso_privacidad": "..."
}
```

`tool_name = 'archivos'` no es una herramienta del agente: `buildTools` ignora
los nombres que no están en `ACTION_TOOL_DEFS`, así que no le añade nada al
modelo. La marca (nombre, logo, color) sale de `proyectos.chatbot_config`.

## Variables de entorno

```
DOCS_WEBHOOK_SECRET=...                        # secreto compartido para pedir enlaces
DOCS_PUBLIC_URL=https://api-v2.genchats.app    # dominio con el que se construyen
```

Genéralo con `openssl rand -hex 32`.

## Crear un enlace

```bash
curl -X POST https://api-v2.genchats.app/api/archivos/enlace \
  -H "x-docs-secret: $DOCS_WEBHOOK_SECRET" -H "Content-Type: application/json" \
  -d '{"proyecto_id":"...","customer_id":"...","permisos":["subir","descargar"]}'
```

Devuelve `url`, `enlace_id` y `expira_en`. La URL solo se puede leer una vez:
después ya no hay forma de recuperarla, solo de revocarla y emitir otra.

## La pestaña del panel

En la cabecera del chat, junto a las notas internas. Muestra los archivos del
contacto con su procedencia (`tuyo`, `lo subió el cliente`, `WhatsApp`…),
permite subir y borrar, y genera el magic link ya copiado al portapapeles para
pegárselo al cliente por donde sea.

Cuelga de `/api/conversations/:id/archivos` y reutiliza el id compuesto del
panel, pero **el backend resuelve el contacto detrás del hilo**: así el panel no
toca la capa de identidad omnicanal y los archivos de un cliente son los mismos
se abra el chat que se abra. Si la conversación todavía no tiene contacto
asociado, la pestaña lo explica en vez de fallar.

Los nombres de fichero se transliteran y se sanean antes de construir la ruta, y
llevan marca de tiempo delante para que dos homónimos no se pisen.

## Pendiente

- Que el agente genere el enlace en conversación: hoy hay que llamar a la API.
  En `FADECOM_Reservas_v1` la acción `solicitar_documentacion` todavía devuelve
  el enlace fijo de Dropbox guardado en `project_tools.config.enlace_subida_fotos`.
- Archivar automáticamente los adjuntos de WhatsApp. Hoy `ycloudWebhook.js:70`
  los descarta. **Ojo**: las URLs de YCloud caducan, así que hay que traerse el
  fichero en el momento del webhook, no bajo demanda.
- Limpieza periódica de enlaces caducados (ya hay índice para ello).

## Pruebas

`prueba.mjs` levanta un PostgREST y un Storage de mentira y recorre el flujo
completo: creación del enlace, portal, subida, cuota agotada, descargas
firmadas, permisos, caducidad, revocación y aislamiento entre contactos.
Los triggers de la migración se prueban aparte contra un Postgres local.
