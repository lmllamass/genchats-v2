# Guía de pruebas de v2 · agosto 2026

Todo lo construido estos días, qué cambia respecto a v1, y cómo probarlo antes
de decidir si sube a producción.

**Entorno:** `https://v2.genchats.app` (panel) · `https://api-v2.genchats.app` (API)
**Proyecto de pruebas:** FADECOM — `ced4f240-94a9-414f-9712-fb093a473a8d`

---

## 1. Qué cambia respecto a v1

| | v1 (producción) | v2 (a probar) |
|---|---|---|
| **Historial que ve el agente** | los mensajes MÁS ANTIGUOS del cliente | los últimos 20-30, en orden |
| **Acciones de n8n** | el modelo recibía `"Workflow was started"` | respuesta real y síncrona (~2 s) |
| **Declaración de acciones** | solo en el prompt | en el **esquema** de la herramienta (enum) |
| **Identidad del contacto** | la IP funde contactos | solo emparejan identidades de persona |
| **Turno truncado** | «no pude procesar tu consulta» | reintenta y sale adelante |
| **Documentación del cliente** | enlace fijo de Dropbox, igual para todos | portal por contacto, con caducidad |
| **Acuse de recibo** | ninguno | marca la ficha en el Excel |
| **Archivos en el panel** | no existe | pestaña en la ficha del contacto |
| **Consentimiento RGPD** | no existe | casilla + registro con fecha |
| **Nombres en el inbox** | `web_mshg95z5_e3zhvt2e` | nombre y teléfono del contacto |
| **Recordatorio de curso** | no existe | WhatsApp 24 h antes (sin activar) |

### Los cuatro bugs de fondo que se arreglaron

Ninguno era del prompt, y **los cuatro existen igual en v1**:

1. **`loadCustomerHistory` traía los mensajes más antiguos.** Un cliente con 160
   mensajes daba contexto de días atrás: el agente olvidaba la sede, se repetía
   y prometía respuestas ya dadas.
2. **La herramienta `custom` no declaraba sus acciones.** El modelo las invocaba
   como herramientas sueltas y fallaban.
3. **La IP se usaba para emparejar contactos.** Como el chatbot público reenvía
   al propio backend, todos los visitantes llegaban con `::1` y **acababan
   siendo el mismo contacto**. En FADECOM: una ficha con 46 identidades y seis
   teléfonos de personas distintas.
4. **El tope de tokens estaba en 600.** Si el modelo se pasaba justo mientras
   escribía una llamada a herramienta, el turno moría con un mensaje de error.

> El 3 es el más serio si se lleva a v1 tal cual: con la zona de archivos activa,
> un enlace del portal habría enseñado la documentación de unos clientes a otros.

---

## 2. Cómo probarlo

### 2.1 El chatbot web y el flujo completo

Abre `https://v2.genchats.app/chat/ced4f240-94a9-414f-9712-fb093a473a8d` y sigue
esta conversación. Entre corchetes, lo que hay que comprobar.

| Dices | Debe pasar |
|---|---|
| `hola` | Saluda y pregunta. **No** suelta el catálogo entero |
| `quiero info del curso de carretillero` | Precio (85 €) y las dos modalidades |
| `vivo en Illescas` | Ofrece Toledo y Fuenlabrada, **no** una sede al azar |
| `en Toledo` | Consulta fechas **reales** (tarda 5-8 s). Si no hay, lo dice y propone alternativa |
| `el lunes 10` | Acepta la fecha |
| `Juan Pérez López, 611223344` | «Plaza apartada» y pide el DNI |
| `12345678Z` | Devuelve un enlace `api-v2.genchats.app/p/…` |

**Lo que NO debe pasar:** inventarse fechas, decir «te he enviado un enlace por
correo» (no puede enviar correos), dar por cerrada la inscripción sin el enlace,
o responder «Lo siento, no pude procesar tu consulta».

### 2.2 El portal de documentación

Abre el enlace **desde el móvil** — es donde tiene sentido.

- [ ] Sale con la marca del negocio y **tu nombre**
- [ ] Al tocar cada documento se abre la cámara directamente
- [ ] Las fotos suben en segundos (se comprimen de ~6 MB a ~300 KB)
- [ ] Al completar los tres, aparece la pantalla de «Recibido»
- [ ] Si recargas, siguen marcados y **no** se vuelve a avisar al negocio

**Caducidad y revocación:** pide un enlace, revócalo desde el panel y vuelve a
abrirlo → debe decir que no es válido, sin explicar por qué.

### 2.3 La pestaña Archivos del panel

`v2.genchats.app` → **Inbox** → abre la conversación → icono del **clip** 📎.

- [ ] La lista del inbox muestra **nombre y teléfono**, no `web_msh…`
- [ ] Los archivos salen etiquetados «lo subió el cliente»
- [ ] *Subir un archivo* funciona y aparece como «tuyo»
- [ ] *Pedirle archivos* copia el enlace al portapapeles
- [ ] Descargar un archivo lo baja **como adjunto** (no lo abre en el navegador)
- [ ] Los enlaces activos muestran caducidad y cuántas veces se abrieron

### 2.4 El acuse de recibo

Al completar la subida, en el Excel de Dropbox
(`/FADECOM_Alumnos_Ejemplo_2026-09.xlsx`, dentro de la carpeta de la app):

- [ ] La fila del alumno pasa a `foto_validada = SI`
- [ ] Se rellena su **DNI** (antes esa columna quedaba siempre vacía)
- [ ] Aparece `carpeta_documentacion` y la fecha de recepción

### 2.5 El recordatorio de 24 h — **sin activar**

`FADECOM_Recordatorio_24h` (`Fq4DdYL65tSaCvG7`) está creado pero **inactivo a
propósito: envía WhatsApps reales**.

Antes de activarlo, comprueba que el Excel no tenga filas de prueba con números
de personas reales. Y ten en cuenta que **si se ejecuta dos veces el mismo día,
avisa dos veces**: el filtro mira `recordatorio_enviado`, pero nada escribe ese
campo todavía.

---

## 3. Los canales: qué se comparte y qué no

**Lo comprobado en el código:** web, WhatsApp, Telegram y voz usan **el mismo
motor** — `buildTools`, `runAgentLoop` y la misma configuración de acciones. Así
que todo lo arreglado (historial, esquema de herramientas, reintento, identidad)
**aplica a los cuatro canales sin tocar nada más**.

Lo que sí cambia por canal:

| | Prompt | Formato | Base de conocimiento |
|---|---|---|---|
| Web | `buildSystemPrompt` | Markdown | `knowledge_base` |
| WhatsApp | `buildSystemPrompt` | texto plano, `*negrita*` | `knowledge_base` |
| Telegram | `buildSystemPrompt` | texto plano | `knowledge_base` |
| **Voz** | **prompt propio** | 2-3 frases, sin emojis ni URLs | **`knowledge_base_voz`** |

### El traspaso desde la llamada

Tenías razón en que por voz no se puede completar una inscripción: nadie teclea
un DNI ni sube una foto por teléfono. **Eso ya está resuelto y funciona:**

- El agente de voz **conoce el número desde el que llaman** y tiene la
  herramienta `enviar_whatsapp`. El prompt le dice explícitamente que no pregunte
  el número, que ya lo tiene.
- Si la ventana de 24 h está cerrada —lo normal en alguien que solo ha
  llamado—, el mensaje **se manda dentro de una plantilla aprobada**, en una
  sola llamada. No se queda sin enviar.
- Si el WhatsApp falla, el prompt le hace ofrecer el email como alternativa.
- Y hay una regla para que **repita en voz alta, dígito a dígito**, cualquier
  número o email dictado antes de usarlo — los números hablados se transcriben
  mal con frecuencia.

**Lo que falta** es que el guion de voz sepa que, en cuanto el cliente decide
inscribirse, debe dejar de intentar cerrar por teléfono y mandar el enlace. Eso
es texto, no código: va en `knowledge_base_voz`, que **sí es editable desde el
panel** (pestaña Chatbot). Sugerencia:

> Por teléfono puedes informar y apartar la plaza, pero **la inscripción no se
> termina por voz**. En cuanto el cliente diga que quiere apuntarse: toma nombre,
> teléfono y sede, aparta la plaza, y dile que le mandas por WhatsApp el enlace
> para subir el DNI y la foto. Usa `enviar_whatsapp`. No le pidas el DNI en voz
> alta ni le dictes la dirección del enlace.

---

## 4. Qué puede configurar el tenant hoy

Aquí conviene ser claro, porque la respuesta es «a medias».

**Sí, desde el panel** (pestaña Chatbot): nombre del negocio, logo, colores,
mensaje de bienvenida, teléfono, email, dirección, `knowledge_base` y
`knowledge_base_voz`.

**No, solo en base de datos** — la tabla `project_tools` **no tiene interfaz**:

- Qué acciones existen y cómo se describen al modelo
- Qué documentos pide el portal (`slots`)
- La URL de la política de privacidad (`url_privacidad`)
- El webhook del acuse de recibo
- Los días de caducidad de los enlaces
- Las rutas de los ficheros en Dropbox

Hoy eso lo tocamos nosotros con un script. Para que un tenant monte su propio
flujo sin ayuda haría falta una pantalla de configuración de acciones y otra de
la zona de archivos. **Es el siguiente trozo grande de producto**, y hasta que
exista, cada cliente nuevo necesita que alguien le configure esto a mano.

---

## 5. Antes de subir a v1

1. **Las migraciones.** v2 va por la `024`. Hay que comprobar cuáles le faltan a
   v1 y aplicarlas en orden, empezando por la identidad omnicanal.
2. **El bug de la IP existe en v1 y ahí hay clientes reales.** Sus contactos
   pueden llevar tiempo fusionándose. Conviene mirar cuántas fichas tienen
   varios teléfonos antes de decidir qué hacer con ellas.
3. **El Excel de FADECOM sigue siendo el de ejemplo.** Cuando el cliente dé el
   suyo, cambiar `dropbox_ruta_alumnos`. **Ojo:** escribir en él lo reconstruye
   y pierde pestañas y formato — es un riesgo real sin resolver.
4. **Falta la URL de la política de privacidad** de FADECOM. Sin ella el portal
   no pide consentimiento.
5. **Limpiar las filas de prueba** del Excel antes de enseñarlo.

---

## 6. Limitaciones conocidas

- **Contactos duplicados:** si la misma persona vuelve otro día por web se crea
  otra ficha, aunque dé el mismo teléfono. Sus archivos quedan repartidos entre
  las dos. La tabla `customer_merge_suggestions` se rellena sola, pero nadie la
  lee.
- **El recordatorio puede duplicar** si se ejecuta a mano dos veces el mismo día.
- **Escribir en el Excel lo reconstruye** (pestañas y formato).
- **Una ficha contaminada** en FADECOM, resto del bug de la IP: ocho
  conversaciones de personas distintas pegadas al mismo contacto.
