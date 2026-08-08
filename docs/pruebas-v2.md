# Guía de pruebas de v2 · agosto 2026

Todo lo construido estos días, qué cambia respecto a v1, y cómo probarlo antes
de decidir si sube a producción.

**Entorno:** `https://v2.genchats.app` (panel) · `https://api-v2.genchats.app` (API)
**Proyecto de pruebas:** FADECOM — `ced4f240-94a9-414f-9712-fb093a473a8d`

> **Las dos bases ya tienen el mismo esquema.** Comparadas columna a columna el
> 8 de agosto: 125 columnas, 21 tablas, dos funciones y el bucket, sin ninguna
> diferencia. v1 está lista para recibir el código cuando se decida.

---

## 1. Qué cambia respecto a v1

| | v1 (producción) | v2 (a probar) |
|---|---|---|
| **Historial que ve el agente** | los mensajes MÁS ANTIGUOS del cliente | los últimos 20-30, en orden |
| **Acciones de n8n** | el modelo recibía `"Workflow was started"` | respuesta real y síncrona (~2 s) |
| **Declaración de acciones** | solo en el prompt | en el **esquema** de la herramienta |
| **Identidad del contacto** | la IP funde contactos distintos | solo emparejan identidades de persona |
| **El mismo teléfono entre canales** | no unía: web y WhatsApp aparte | un solo contacto |
| **Turno truncado** | «no pude procesar tu consulta» | reintenta y sale adelante |
| **Documentación del cliente** | enlace fijo de Dropbox, igual para todos | portal por contacto, con caducidad |
| **Acuse de recibo** | ninguno | marca la ficha en el Excel |
| **Archivos en el panel** | no existe | pestaña en la ficha del contacto |
| **Aviso de privacidad** | no existe | en el primer mensaje, voz y texto |
| **Consentimiento RGPD** | no existe | casilla + registro con fecha |
| **Catálogo de sedes** | escritas a mano dentro de n8n | editables en el panel, con aforo |
| **Sede sin calendario** | «no hay plazas» | «te llama un compañero» |
| **Nombres en el inbox** | `web_mshg95z5_e3zhvt2e` | nombre y teléfono del contacto |
| **Recordatorio de curso** | no existe | WhatsApp 24 h antes (sin activar) |

### Los bugs de fondo que se arreglaron

Ninguno era del prompt, y **todos existen igual en v1**:

1. **La IP se usaba para emparejar contactos.** Como el chatbot público reenvía
   al propio backend, todos los visitantes llegaban con `::1` y **acababan
   siendo el mismo contacto**. En FADECOM: una ficha con 46 identidades y seis
   teléfonos de personas distintas.
2. **Un fallo leyendo la memoria del cliente tumbaba la petición entera.** Un
   dato *opcional* dejaba al chatbot sin responder.
3. **`loadCustomerHistory` traía los mensajes más antiguos.** Un cliente con 160
   mensajes daba contexto de días atrás: el agente olvidaba la sede, se repetía
   y prometía respuestas ya dadas.
4. **La herramienta `custom` no declaraba sus acciones.** El modelo las invocaba
   como herramientas sueltas y fallaban.
5. **El tope de tokens estaba en 600.** Si el modelo se pasaba justo mientras
   escribía una llamada a herramienta, el turno moría con un mensaje de error.
6. **El teléfono se comparaba como texto.** En el chat web el cliente teclea
   `609211040`, por WhatsApp la pasarela da `+34609211040`: la misma persona
   salía como dos contactos y sus archivos quedaban repartidos.

> Los dos primeros son los graves. Uno habría enseñado la documentación de unos
> clientes a otros con la zona de archivos activa; el otro deja el chatbot mudo
> sin motivo aparente.

---

## 2. Cómo probarlo

### 2.1 El chatbot web y el flujo completo

Abre `https://v2.genchats.app/chat/ced4f240-94a9-414f-9712-fb093a473a8d`.

| Dices | Debe pasar |
|---|---|
| `hola` | Saluda y pregunta. **No** suelta el catálogo entero |
| `quiero info del curso de carretillero` | Precio (85 €) y las dos modalidades |
| `vivo en Illescas` | Ofrece Toledo y Fuenlabrada, **no** una sede al azar |
| `en Alcalá` | Consulta fechas **reales** (5-8 s) |
| `el lunes 10` | Acepta la fecha |
| `Juan Pérez López, 611223344` | «Plaza apartada» y pide el DNI |
| `12345678Z` | Devuelve un enlace `api-v2.genchats.app/p/…` |

**Lo que NO debe pasar:** inventarse fechas, decir «te he enviado un enlace por
correo» (no puede enviar correos), dar por cerrada la inscripción sin el enlace,
o responder «Lo siento, no pude procesar tu consulta».

### 2.2 La sede sin calendario

Pide el curso **en Toledo**. Debe decir que un compañero se encarga y pedirte
nombre y teléfono — **nunca** que no hay plazas, que es lo que decía antes.

### 2.3 El portal de documentación

Abre el enlace **desde el móvil**.

- [ ] Sale con la marca del negocio y **tu nombre**
- [ ] Al tocar cada documento se abre la cámara directamente
- [ ] Las fotos suben en segundos (se comprimen de ~6 MB a ~300 KB)
- [ ] Al completar los tres, aparece la pantalla de «Recibido»
- [ ] Si recargas, siguen marcados y **no** se vuelve a avisar al negocio
- [ ] Un enlace revocado desde el panel deja de abrir, sin explicar por qué

### 2.4 El mismo cliente por dos canales

Escribe por el chat web dando tu teléfono **sin prefijo**, y luego manda un
WhatsApp al número del negocio desde ese mismo teléfono.

- [ ] En el Inbox aparece **un solo contacto**, no dos
- [ ] La ficha muestra el teléfono en formato legible

### 2.5 La pestaña Archivos del panel

**Inbox** → abre la conversación → icono del **clip** en la cabecera.

- [ ] La lista del inbox muestra **nombre y teléfono**, no `web_msh…`
- [ ] Los archivos salen etiquetados «lo subió el cliente»
- [ ] *Subir un archivo* funciona y aparece como «tuyo»
- [ ] *Pedirle archivos* copia el enlace al portapapeles
- [ ] Descargar lo baja **como adjunto**, no lo abre en el navegador
- [ ] Los enlaces activos muestran caducidad y veces abierto

### 2.6 El editor de sedes

**Chatbot → Reservas.** Cada sede tiene un **lápiz** que la convierte en
formulario en su sitio.

- [ ] Se edita nombre, dirección, **aforo**, alias del Excel y el interruptor
- [ ] Desmarcar «el chatbot puede reservar aquí» hace que derive a una persona
- [ ] La tarjeta muestra el aforo y con qué nombre aparece en el calendario
- [ ] El aforo de la sede manda sobre el general del proyecto

### 2.7 El aviso de privacidad

**Chatbot → Privacidad.** Escribe la URL de la política y guarda.

- [ ] Con el campo vacío no se menciona nada — es lo correcto
- [ ] Con URL, sale en el **primer** mensaje y no se repite después
- [ ] Es una frase al final, no un formulario: no pide que contestes «acepto»
- [ ] Por teléfono lo menciona de palabra y **no dicta la dirección**
- [ ] El portal de documentos usa esa misma URL en su casilla

En la ficha del contacto queda guardado **qué política se le enseñó, cuándo y
por qué canal**.

### 2.8 El acuse de recibo

Al completar la subida, en el Excel de Dropbox:

- [ ] La fila del alumno pasa a `foto_validada = SI`
- [ ] Se rellena su **DNI** (antes esa columna quedaba siempre vacía)
- [ ] Aparecen la carpeta y la fecha de recepción

### 2.9 El recordatorio de 24 h — **sin activar**

`FADECOM_Recordatorio_24h` (`Fq4DdYL65tSaCvG7`) está creado pero **inactivo a
propósito: envía WhatsApps reales**.

Antes de activarlo, comprueba que el Excel no tenga filas de prueba con números
de personas reales. Y ten en cuenta que **si se ejecuta dos veces el mismo día,
avisa dos veces**: el filtro mira `recordatorio_enviado`, pero nada escribe ese
campo todavía.

---

## 3. Los canales: qué se comparte

Web, WhatsApp, Telegram y voz usan **el mismo motor** — `buildTools`,
`runAgentLoop` y la misma configuración de acciones. Todo lo arreglado aplica a
los cuatro sin tocar nada más.

| | Prompt | Formato | Base de conocimiento |
|---|---|---|---|
| Web | común | Markdown | `knowledge_base` |
| WhatsApp | común | texto plano, `*negrita*` | `knowledge_base` |
| Telegram | común | texto plano | `knowledge_base` |
| **Voz** | **propio** | 2-3 frases, sin emojis ni URLs | **`knowledge_base_voz`** |

### La voz

**Funciona en v2.** Hay agentes de otros proyectos apuntando ya a
`wss://api-v2.genchats.app/api/retell/llm/<proyecto_id>`.

FADECOM tiene **su propia cuenta de Retell** (por facturación), así que su
agente no se ve desde la cuenta de plataforma. Para probar basta con apuntar un
agente cualquiera a:

```
wss://api-v2.genchats.app/api/retell/llm/ced4f240-94a9-414f-9712-fb093a473a8d
```

No hace falta tocar nada en el panel: `retell_agent_id` solo sirve para empujar
ajustes de voz desde el admin, no para recibir llamadas. El id del proyecto
viaja en esa URL.

La base de conocimiento de voz ya está cargada
(`fadecom/genchats/knowledge_base_voz.txt`). El traspaso está resuelto: el
agente conoce el número desde el que llaman, y si la ventana de 24 h está
cerrada el mensaje va dentro de una plantilla aprobada, así que no se pierde.

---

## 4. Qué puede configurar el tenant

**Desde el panel:** nombre, logo y colores · mensaje de bienvenida · teléfono,
email y dirección · base de conocimiento · base de conocimiento de voz · **URL
de la política de privacidad** · **sedes con su aforo, alias y si son
reservables**.

**Solo en base de datos** (`project_tools` no tiene interfaz): qué acciones
existen y cómo se describen al modelo · qué documentos pide el portal · el
webhook del acuse de recibo · la caducidad de los enlaces · las rutas de los
ficheros en Dropbox.

Queda menos que antes, pero para que un cliente monte su flujo sin ayuda sigue
faltando una pantalla de acciones. **Es el siguiente trozo grande de producto.**

---

## 5. El paso a v1

### Esquema: hecho

Las tres migraciones que faltaban (**023, 024 y 025**) están aplicadas, y las dos
bases quedan idénticas. Ficheros en `docs/migraciones/`.

Ninguna altera el funcionamiento actual de v1: solo añaden columnas nuevas a
`NULL`, tablas nuevas y un bucket.

### Lo que queda al desplegar el código

1. **Variables de entorno** del backend de v1:
   ```
   DOCS_WEBHOOK_SECRET=...          # openssl rand -hex 32
   DOCS_PUBLIC_URL=https://api.genchats.app
   ```
   Sin ellas el portal arranca pero no emite enlaces, y parece un fallo del código.
2. **Revisar los contactos de v1**, que llevan tiempo con el bug de la IP: mirar
   cuántas fichas tienen varios teléfonos antes de decidir qué hacer con ellas.
3. **Dar de alta las sedes** de cada proyecto en Chatbot → Reservas.
4. **El Excel de FADECOM sigue siendo el de ejemplo.** Cuando el cliente dé el
   suyo, cambiar `dropbox_ruta_alumnos`. Ojo: escribir en él lo reconstruye y
   pierde pestañas y formato — riesgo real sin resolver.
5. **Limpiar las filas de prueba** del Excel antes de enseñarlo.

---

## 6. Limitaciones conocidas

- **Contactos duplicados:** el teléfono ya une los canales, pero quien vuelve
  desde **otro navegador y no deja su teléfono** sigue creando ficha nueva. No
  hay forma de saber que es la misma persona. La tabla
  `customer_merge_suggestions` se rellena sola, pero nadie la lee.
- **El prefijo se asume español:** un número extranjero de nueve dígitos sin
  prefijo se etiquetaría mal. Si algún día hay clientes fuera, se decide por
  proyecto.
- **El recordatorio puede duplicar** si se ejecuta a mano dos veces el mismo día.
- **Escribir en el Excel lo reconstruye** (pestañas y formato).
- **Una ficha contaminada** en FADECOM, resto del bug de la IP: ocho
  conversaciones de personas distintas pegadas al mismo contacto.
