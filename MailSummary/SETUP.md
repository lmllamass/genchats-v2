# MailSummary — Guía de Configuración

## Requisitos

- Xcode 15 o superior
- iOS 16 o superior en el dispositivo / simulador
- Cuenta de desarrollador de Apple (para instalar en dispositivo físico)
- API key de Anthropic
- Bot de Telegram (token y chat ID)

---

## 1. Abrir el proyecto en Xcode

```bash
open MailSummary/MailSummary.xcodeproj
```

En Xcode:
1. Selecciona el target **MailSummary**.
2. En **Signing & Capabilities** → elige tu **Team** de desarrollo.
3. Cambia el **Bundle Identifier** si es necesario (por defecto `com.mailsummary.app`).

---

## 2. Activar Background App Refresh en Xcode

1. En el target, ve a **Signing & Capabilities**.
2. Pulsa **+ Capability** → añade **Background Modes**.
3. Activa las casillas:
   - ✅ Background fetch
   - ✅ Background processing
4. Verifica que en `Info.plist` existe la clave `BGTaskSchedulerPermittedIdentifiers` con el valor `com.mailsummary.daily-email-summary`.

> **Importante:** El Bundle Identifier del target debe coincidir con el de la firma en `Info.plist`.

---

## 3. Crear el bot de Telegram con BotFather

### Paso 1 — Crear el bot

1. Abre Telegram y busca **@BotFather**.
2. Envía `/newbot`.
3. Elige un nombre para el bot (ej. `Mi Resumen de Correo`).
4. Elige un username único (debe terminar en `bot`, ej. `mi_correo_bot`).
5. BotFather te dará un **token** con este formato:
   ```
   1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
   ```
   Guárdalo, lo necesitarás en la app.

### Paso 2 — Obtener el Chat ID

**Opción A — Chat personal:**
1. Envía cualquier mensaje al bot que acabas de crear.
2. Abre en tu navegador:
   ```
   https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
3. Busca `"chat":{"id":XXXXXXXX}` — ese número es tu Chat ID.

**Opción B — Usar @userinfobot:**
1. Busca **@userinfobot** en Telegram.
2. Envía `/start` — te responderá con tu ID numérico.

**Opción C — Grupo o canal:**
1. Añade el bot al grupo/canal como administrador.
2. Envía un mensaje en el grupo.
3. Abre la URL de `getUpdates` (ver Opción A).
4. El Chat ID del grupo empieza por `-100`.

---

## 4. Obtener la API Key de Anthropic

1. Accede a [console.anthropic.com](https://console.anthropic.com).
2. Ve a **API Keys** → **Create Key**.
3. Copia la clave (comienza con `sk-ant-api03-…`).

---

## 5. Configurar las cuentas de correo IMAP

La app usa IMAP directo (no requiere Apple Mail). Configuraciones habituales:

| Proveedor | Servidor IMAP          | Puerto | SSL |
|-----------|------------------------|--------|-----|
| Gmail     | `imap.gmail.com`       | 993    | ✅  |
| Outlook   | `outlook.office365.com`| 993    | ✅  |
| Yahoo     | `imap.mail.yahoo.com`  | 993    | ✅  |
| iCloud    | `imap.mail.me.com`     | 993    | ✅  |
| Personal  | Tu servidor IMAP       | 993    | ✅  |

### Gmail — Contraseña de aplicación (recomendado)

Gmail bloquea el acceso IMAP con contraseña normal si tienes 2FA activa.
Usa una **App Password**:

1. Ve a [myaccount.google.com](https://myaccount.google.com) → **Seguridad**.
2. En "Cómo inicias sesión en Google" → **Verificación en 2 pasos** (debe estar activada).
3. Busca **Contraseñas de aplicaciones** (al final de la sección).
4. Selecciona **Correo** y **iPhone** → **Generar**.
5. Usa esa contraseña de 16 caracteres en la app.

---

## 6. Primera ejecución

1. Abre la app → pestaña **Configuración**.
2. Introduce el **token del bot** y el **Chat ID** de Telegram.
3. Introduce la **API key de Anthropic**.
4. Pulsa **Probar conexión Telegram** para verificar.
5. Añade tu cuenta de correo con **Añadir cuenta IMAP**.
6. Elige la **hora de envío diario**.
7. Activa **Envío automático**.
8. Pulsa **Guardar configuración**.
9. Vuelve a la pestaña **Resumen** → **Ejecutar ahora** para hacer una prueba manual.

---

## 7. Formato del mensaje enviado a Telegram

```
📬 *Resumen de correo — 9 jun 2025 08:00*

━━━━━━━━━━━━━━━━━━━━━
📢 *PUBLICIDAD / NEWSLETTERS* (12 correos)
Remitentes: Amazon, Zara, LinkedIn, Booking, El Corte Inglés, Airbnb…
━━━━━━━━━━━━━━━━━━━━━

📌 *CORREOS IMPORTANTES* (3 correos)

*1. Juan García — juan@empresa.com*
📋 Asunto: Reunión presupuesto Q3
• Solicita confirmación para el lunes a las 10:00
• Adjunta borrador del presupuesto revisado
• Pide respuesta antes del viernes

*2. Banco Santander — alertas@santander.es*
📋 Asunto: Movimiento en tu cuenta
• Cargo de 245,00 € en comercio online
• Fecha: 09/06/2025 a las 07:43
• Si no reconoces el cargo, contacta con el banco

*3. María López — maria.lopez@cliente.com*
📋 Asunto: Aprobación propuesta diseño
• Aprueba la propuesta enviada el martes
• Solicita inicio de trabajos para la semana próxima
• Pregunta por disponibilidad para llamada esta tarde

━━━━━━━━━━━━━━━━━━━━━
_Generado por MailSummary · claude-sonnet-4-20250514_
```

---

## 8. Notas sobre el Background App Refresh

iOS gestiona de forma inteligente cuándo ejecutar las tareas en segundo plano
basándose en el uso de la batería, conectividad y patrones de uso del usuario.
Esto significa que la tarea puede ejecutarse **algunos minutos antes o después**
de la hora configurada.

Para aumentar la fiabilidad:
- Mantén la app activa regularmente (iOS aprende tus patrones de uso).
- No desactives el Background App Refresh en los Ajustes del sistema.
- Asegúrate de tener conectividad Wi-Fi disponible a la hora configurada.

Para forzar la ejecución durante el desarrollo en Xcode, usa:
```
e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.mailsummary.daily-email-summary"]
```
en la consola del debugger (lldb) con la app en segundo plano.

---

## 9. Estructura del proyecto

```
MailSummary/
├── MailSummaryApp.swift          # Punto de entrada, registro de tareas BG
├── AppDelegate.swift             # Gestión del ciclo de vida
├── Models/
│   ├── Email.swift               # Modelo de email + clasificación heurística
│   ├── EmailSummary.swift        # Modelo de resumen + persistencia
│   └── AppSettings.swift        # Preferencias en UserDefaults
├── ViewModels/
│   ├── MainViewModel.swift       # Lógica del dashboard
│   └── ConfigurationViewModel.swift # Lógica del formulario de config
├── Views/
│   ├── ContentView.swift         # TabView raíz
│   ├── DashboardView.swift       # Pantalla principal
│   ├── HistoryView.swift         # Historial de resúmenes
│   └── ConfigurationView.swift  # Pantalla de configuración
├── Services/
│   ├── KeychainService.swift     # CRUD seguro en Keychain
│   ├── IMAPService.swift         # Cliente IMAP nativo (Network.framework)
│   ├── AnthropicService.swift    # Integración con Claude API
│   ├── TelegramService.swift     # Telegram Bot API
│   ├── BackgroundTaskService.swift # BGTaskScheduler
│   └── MailOrchestrator.swift   # Orquestador del pipeline completo
└── Resources/
    └── Info.plist                # Permisos y configuración del sistema
```
