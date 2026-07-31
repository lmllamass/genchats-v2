import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle, Phone, Mic, Building2, CheckCircle2, Mail } from "lucide-react";

const FONT_D = "'Space Grotesk', sans-serif";
const ADMIN_EMAIL = "info@konkabeza.es";

function Paso({ n, children }) {
  return (
    <li style={{ display: "flex", gap: 12, marginBottom: 12 }}>
      <span style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
        background: "rgba(139,92,246,0.15)", color: "#c4b5fd",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, fontFamily: FONT_D,
      }}>{n}</span>
      <span style={{ paddingTop: 2 }}>{children}</span>
    </li>
  );
}

function Enviar({ items }) {
  return (
    <div style={{
      marginTop: 16, borderRadius: 12, border: "1px solid rgba(74,222,128,0.2)",
      background: "rgba(74,222,128,0.05)", padding: "16px 20px",
    }}>
      <p style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, color: "#86efac", marginBottom: 8, fontSize: 14 }}>
        <Mail style={{ width: 15, height: 15 }} /> Cuando lo tengas, envíanos por email a{" "}
        <a href={`mailto:${ADMIN_EMAIL}`} style={{ color: "#86efac", textDecoration: "underline" }}>{ADMIN_EMAIL}</a>:
      </p>
      <ul style={{ color: "#bbf7d0", fontSize: 14, lineHeight: 1.8, paddingLeft: 20 }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

function Seccion({ id, icon, titulo, subtitulo, children }) {
  return (
    <section id={id} style={{ scrollMarginTop: 90, marginBottom: 56 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{icon}</div>
        <h2 style={{ fontFamily: FONT_D, fontSize: 22, fontWeight: 700, color: "#fff" }}>{titulo}</h2>
      </div>
      <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20, marginLeft: 52 }}>{subtitulo}</p>
      <div style={{ marginLeft: 52 }}>{children}</div>
    </section>
  );
}

export default function ConfiguracionInicial() {
  return (
    <div style={{ backgroundColor: "#0a0a0f", minHeight: "100vh", color: "#f8fafc" }}>
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", backgroundColor: "rgba(10,10,15,0.95)", padding: "14px 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: "48rem", margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/app" style={{ color: "#94a3b8", display: "flex", alignItems: "center" }}>
            <ArrowLeft style={{ width: 18, height: 18 }} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageCircle style={{ width: 14, height: 14, color: "#fff" }} />
            </div>
            <span style={{ fontFamily: FONT_D, fontWeight: 700, fontSize: 16, color: "#fff" }}>GenChats IA</span>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: "48rem", margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 999, background: "rgba(139,92,246,0.1)", color: "#c4b5fd", fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
            <CheckCircle2 style={{ width: 13, height: 13 }} /> Pago confirmado
          </div>
          <h1 style={{ fontFamily: FONT_D, fontSize: 32, fontWeight: 700, marginBottom: 12, color: "#fff" }}>
            Configuración inicial de tu chatbot
          </h1>
          <p style={{ color: "#cbd5e1", fontSize: 15, lineHeight: 1.7 }}>
            Para dejar tu chatbot 100% operativo necesitamos que abras algunas cuentas en los proveedores
            que usamos para WhatsApp y, si tienes el plan Super Pro, para el agente de voz. Es un proceso
            de una sola vez: tú abres la cuenta (gratis en todos los casos) y nos envías los datos de acceso
            o el ID correspondiente para que nosotros terminemos de conectarlo todo. Normalmente lo dejamos
            activo en 24-48h laborables tras recibir los datos.
          </p>
        </div>

        {/* Índice */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 48 }}>
          {[
            ["#ycloud", "1. YCloud (WhatsApp)"],
            ["#meta", "2. Meta WhatsApp Business"],
            ["#retell", "3. Retell (Voz) — Super Pro"],
            ["#resend", "4. Resend (Email)"],
          ].map(([href, label]) => (
            <a key={href} href={href} style={{
              fontSize: 13, color: "#c4b5fd", textDecoration: "none",
              border: "1px solid rgba(139,92,246,0.25)", borderRadius: 999, padding: "6px 14px",
            }}>{label}</a>
          ))}
        </div>

        <Seccion
          id="ycloud"
          icon={<Phone style={{ width: 19, height: 19, color: "#fff" }} />}
          titulo="1. Cuenta en YCloud"
          subtitulo="YCloud es el proveedor (BSP) que conecta tu número de WhatsApp con nuestra plataforma. Es gratuito crear la cuenta; solo pagas los mensajes que se envían, con tarifas muy bajas."
        >
          <ol style={{ listStyle: "none", padding: 0, color: "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
            <Paso n={1}>Entra en <a href="https://www.ycloud.com/en/signup" target="_blank" rel="noreferrer" style={{ color: "#a5b4fc" }}>ycloud.com/en/signup</a> y crea una cuenta con el email de tu negocio.</Paso>
            <Paso n={2}>Verifica el email y accede al panel (dashboard).</Paso>
            <Paso n={3}>En el menú lateral entra en <strong>WhatsApp → Get Started</strong> y sigue el asistente para vincular un número de teléfono (puede ser un número nuevo o uno que ya uses, siempre que no tenga WhatsApp personal activo).</Paso>
            <Paso n={4}>Ve a <strong>Settings → API Keys</strong> y genera una API Key.</Paso>
          </ol>
          <Enviar items={[
            "Email con el que creaste la cuenta YCloud",
            "La API Key generada",
            "El número de teléfono que vas a usar para WhatsApp (con prefijo internacional)",
          ]} />
        </Seccion>

        <Seccion
          id="meta"
          icon={<Building2 style={{ width: 19, height: 19, color: "#fff" }} />}
          titulo="2. Meta WhatsApp Business"
          subtitulo="Meta (Facebook) es quien autoriza el uso oficial de la API de WhatsApp Business. Se gestiona a través de Meta Business Suite y va ligado a tu cuenta de YCloud."
        >
          <ol style={{ listStyle: "none", padding: 0, color: "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
            <Paso n={1}>Entra en <a href="https://business.facebook.com" target="_blank" rel="noreferrer" style={{ color: "#a5b4fc" }}>business.facebook.com</a> y crea (o usa) una cuenta de empresa de Meta.</Paso>
            <Paso n={2}>Dentro de YCloud, en el asistente de WhatsApp del paso anterior, se te pedirá conectar tu WhatsApp Business Account (WABA) con Meta — el propio asistente te guía y crea la WABA si no la tienes.</Paso>
            <Paso n={3}>Verifica el negocio en Meta si te lo solicita (nombre legal, dirección, teléfono de contacto).</Paso>
            <Paso n={4}>Una vez conectado, en YCloud verás tu <strong>WABA ID</strong> y el <strong>Phone Number ID</strong> en la sección WhatsApp → Numbers.</Paso>
          </ol>
          <Enviar items={[
            "WABA ID (WhatsApp Business Account ID)",
            "Phone Number ID",
            "Nombre del negocio tal y como quieres que aparezca en WhatsApp",
          ]} />
        </Seccion>

        <Seccion
          id="retell"
          icon={<Mic style={{ width: 19, height: 19, color: "#fff" }} />}
          titulo="3. Cuenta en Retell (solo plan Super Pro)"
          subtitulo="Retell es el motor de voz que permite que tu chatbot atienda llamadas telefónicas. Solo aplica si contrataste el plan Super Pro."
        >
          <ol style={{ listStyle: "none", padding: 0, color: "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
            <Paso n={1}>Entra en <a href="https://dashboard.retellai.com" target="_blank" rel="noreferrer" style={{ color: "#a5b4fc" }}>dashboard.retellai.com</a> y crea una cuenta con el email de tu negocio.</Paso>
            <Paso n={2}>Ve a <strong>Settings → API Keys</strong> y genera una API Key.</Paso>
            <Paso n={3}>Indícanos si quieres usar un número de teléfono nuevo (te damos uno) o portar uno que ya tengas.</Paso>
          </ol>
          <Enviar items={[
            "Email con el que creaste la cuenta Retell",
            "La API Key generada",
            "Si quieres número nuevo o portar uno existente (y cuál)",
          ]} />
        </Seccion>

        <Seccion
          id="resend"
          icon={<Mail style={{ width: 19, height: 19, color: "#fff" }} />}
          titulo="4. Email desde tu dominio (Resend)"
          subtitulo="Para que el chatbot pueda enviar emails a tus clientes (confirmaciones, seguimientos) y que lleguen desde tu propia dirección, no desde una genérica. Esto es lo que evita que acaben en spam."
        >
          <ol style={{ listStyle: "none", padding: 0, color: "#e2e8f0", fontSize: 14, lineHeight: 1.6 }}>
            <Paso n={1}>Entra en <a href="https://resend.com/signup" target="_blank" rel="noreferrer" style={{ color: "#a5b4fc" }}>resend.com/signup</a> y crea una cuenta con el email de tu negocio (el plan gratuito cubre 3.000 emails al mes).</Paso>
            <Paso n={2}>Ve a <strong>Domains → Add Domain</strong> e introduce el dominio de tu web (por ejemplo <em>minegocio.com</em>, sin el www).</Paso>
            <Paso n={3}>Resend te mostrará unos <strong>registros DNS</strong> (SPF y DKIM). Hay que añadirlos donde tengas contratado el dominio — normalmente el mismo panel donde gestionas tu web. Si no sabes hacerlo, pásanos una captura de esos registros y te decimos exactamente qué poner, o dáselos a quien te lleve la web.</Paso>
            <Paso n={4}>Cuando Resend marque el dominio como <strong>Verified</strong> (suele tardar de unos minutos a unas horas), ve a <strong>API Keys</strong> y genera una.</Paso>
            <Paso n={5}>Decide desde qué dirección quieres que salgan los emails. Puede ser una que no exista como buzón, por ejemplo <em>reservas@minegocio.com</em> o <em>info@minegocio.com</em>.</Paso>
          </ol>
          <Enviar items={[
            "La API Key de Resend",
            "El dominio verificado",
            "La dirección remitente que quieres usar (ej. reservas@minegocio.com)",
            "El nombre que debe ver el cliente como remitente (ej. Autoescuela Ejemplo)",
          ]} />
        </Seccion>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 24, marginTop: 8 }}>
          <p style={{ color: "#94a3b8", fontSize: 14 }}>
            ¿Dudas con cualquiera de estos pasos? Escríbenos a{" "}
            <a href={`mailto:${ADMIN_EMAIL}`} style={{ color: "#a5b4fc" }}>{ADMIN_EMAIL}</a> o por WhatsApp a{" "}
            <a href="https://wa.me/34919932159" style={{ color: "#a5b4fc" }}>+34 919 932 159</a> y te ayudamos paso a paso.
          </p>
        </div>
      </main>
    </div>
  );
}
