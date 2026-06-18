import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";

const FONT_D = "'Space Grotesk', sans-serif";

export default function Privacidad() {
  return (
    <div style={{ backgroundColor: "#0a0a0f", minHeight: "100vh", color: "#f8fafc" }}>
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", backgroundColor: "rgba(10,10,15,0.95)", padding: "14px 24px" }}>
        <div style={{ maxWidth: "48rem", margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link to="/" style={{ color: "#94a3b8", display: "flex", alignItems: "center" }}>
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
        <h1 style={{ fontFamily: FONT_D, fontSize: 32, fontWeight: 700, marginBottom: 32, color: "#fff" }}>Política de Privacidad</h1>

        <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.8 }} className="space-y-6">
          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>1. Responsable del tratamiento</h2>
            <p><strong>Konkabeza</strong> — konkabeza.es</p>
            <p>Email de contacto: <a href="mailto:hola@konkabeza.es" style={{ color: "#a5b4fc" }}>hola@konkabeza.es</a></p>
            <p>WhatsApp: <a href="https://wa.me/34689656122" style={{ color: "#a5b4fc" }}>+34 689 656 122</a></p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>2. Datos que recopilamos</h2>
            <p>Recopilamos los datos que nos proporcionas voluntariamente: nombre, email, teléfono, datos de tu empresa y las conversaciones con los chatbots creados en la plataforma.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>3. Finalidad del tratamiento</h2>
            <p>Tus datos se utilizan para: prestación del servicio GenChats IA, gestión de tu cuenta, comunicaciones relacionadas con el servicio, y mejora de la plataforma.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>4. Base legal</h2>
            <p>El tratamiento se basa en tu consentimiento al registrarte, la ejecución del contrato de servicio y el interés legítimo para mejorar nuestros servicios.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>5. Conservación</h2>
            <p>Tus datos se conservan mientras mantengas tu cuenta activa. Puedes solicitar su eliminación en cualquier momento.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>6. Tus derechos</h2>
            <p>Tienes derecho de acceso, rectificación, supresión, portabilidad y oposición. Puedes ejercerlos en <a href="mailto:hola@konkabeza.es" style={{ color: "#a5b4fc" }}>hola@konkabeza.es</a>.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>7. Cookies</h2>
            <p>Consulta nuestra <Link to="/cookies" style={{ color: "#a5b4fc" }}>Política de Cookies</Link> para más información.</p>
          </section>
        </div>
      </main>
    </div>
  );
}