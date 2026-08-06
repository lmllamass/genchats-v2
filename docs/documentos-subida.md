# Recogida de documentación (`/d/:token`)

Página propia donde el cliente final sube sus documentos desde el móvil, en
sustitución de los *file request* de Dropbox.

## Por qué no valían los enlaces de Dropbox

- La credencial Dropbox de n8n **no puede pedir el scope `file_requests.write`**
  (n8n cablea sus scopes), así que el enlace había que crearlo a mano en
  dropbox.com y era el mismo para todos los alumnos.
- No había acuse de recibo: aunque el alumno subiera las fotos, nadie se
  enteraba y su fila del Excel seguía igual.
- Un enlace anónimo de `dropbox.com/request/...` no da buena imagen.

Lo que sí puede n8n es **escribir** en Dropbox (`files.content.write`). Por eso
solo faltaba la página que recoge el fichero.

## Cómo funciona

1. El agente llama a la acción `solicitar_documentacion` con el DNI.
2. n8n pide un enlace al backend (`POST /api/documentos/enlace`).
3. El backend devuelve una URL con un **token HMAC autofirmado** que lleva
   dentro proyecto, DNI, nombre, curso, sede, fecha y caducidad. No se guarda en
   ninguna tabla: el cliente exige que no haya base de datos, y así el enlace
   caduca solo.
4. El alumno abre la página en el móvil, hace las fotos y se suben a
   `<carpeta_base>/<DNI>/` en Dropbox. Se comprimen en el navegador antes de
   salir (de ~6 MB a ~300 KB).
5. Al completarse, el backend avisa al webhook de n8n para que marque el Excel.

## Configuración por proyecto

En `project_tools`, fila `tool_name = 'documentos'`:

```json
{
  "carpeta_base": "/Documentacion",
  "dias_validez": 7,
  "webhook_confirmacion": "https://.../webhook/fadecom-doc-recibida",
  "slots": [
    { "id": "dni_anverso", "titulo": "DNI o NIE — parte delantera", "ayuda": "..." },
    { "id": "dni_reverso", "titulo": "DNI o NIE — parte trasera",   "ayuda": "..." },
    { "id": "foto_carnet", "titulo": "Fotografía tipo carnet",      "ayuda": "..." }
  ],
  "aviso_privacidad": "..."
}
```

Si la fila no existe se usan tres documentos por defecto y `/Documentacion`.
La marca (nombre, logo, color) sale de `proyectos.chatbot_config`, la misma que
usa el chatbot.

> `tool_name = 'documentos'` no es una herramienta del agente: `buildTools`
> ignora los nombres que no están en `ACTION_TOOL_DEFS`, así que ponerlo en
> `enabled` no le añade nada al modelo.

## Variables de entorno

```
DOCS_TOKEN_SECRET=...     # firma los enlaces; cambiarlo invalida los ya enviados
DOCS_WEBHOOK_SECRET=...   # secreto compartido con n8n para pedir enlaces
DOCS_PUBLIC_URL=https://api-v2.genchats.app   # dominio con el que se construyen

DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REFRESH_TOKEN=
```

Genera los dos secretos con `openssl rand -hex 32`.

### Obtener el refresh token de Dropbox

Conviene usar **la misma app de Dropbox que ya usa n8n**: así las rutas
coinciden y las fotos caen junto a los Excel. Si se crea una app nueva de tipo
*App folder*, apuntará a otra carpeta distinta.

1. Abre en el navegador (sustituyendo `APP_KEY`):

   ```
   https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline
   ```

2. Acepta y copia el código que muestra.
3. Cámbialo por el refresh token:

   ```bash
   curl -u APP_KEY:APP_SECRET https://api.dropboxapi.com/oauth2/token \
     -d grant_type=authorization_code -d code=EL_CODIGO
   ```

   El campo `refresh_token` de la respuesta es el que va al `.env`. No caduca.

## Cambio pendiente en n8n

En `FADECOM_Reservas_v1` (`kwtRcqLBw2XtsNqL`), rama del DNI:

1. Entre `IF: ¿DNI válido?` (salida *true*) y `Formatear enlace de subida`,
   inserta un **HTTP Request** llamado `Pedir enlace personal`:
   - `POST https://api-v2.genchats.app/api/documentos/enlace`
   - Cabecera `x-docs-secret: <DOCS_WEBHOOK_SECRET>`
   - Cuerpo JSON con `proyecto_id`, `dni`, `nombre`, `curso`, `sede`, `fecha`
   - `onError: continueRegularOutput` — como todos los nodos externos de este
     workflow, para que un fallo no impida llegar al Respond.

2. En `Formatear enlace de subida`, cambia el origen del enlace:

   ```js
   const enlace = $json.url;            // antes: ctx.enlace_subida_fotos
   ```

   Y quita del mensaje lo de *«Ponle tu DNI al nombre del archivo»*: ya no hace
   falta, la carpeta se nombra sola con el DNI.

3. Cuando ese cambio esté hecho, `enlace_subida_fotos` puede borrarse de
   `project_tools.config` (`tool_name = 'custom'`).

Falta también el workflow que recibe `webhook_confirmacion` y marca la fila del
alumno como documentación recibida.

## Pruebas

`backend/lib/dropbox.js` acepta `DROPBOX_API_BASE` y `DROPBOX_CONTENT_BASE`
para apuntar a un Dropbox de mentira, de modo que el flujo entero (enlace →
página → subida → estado → aviso a n8n) se puede probar en local sin
credenciales reales.
