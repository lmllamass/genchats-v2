import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";

const FONT_D = "'Space Grotesk', sans-serif";

export default function Cookies() {
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
        <h1 style={{ fontFamily: FONT_D, fontSize: 32, fontWeight: 700, marginBottom: 32, color: "#fff" }}>Política de Cookies</h1>

        <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.8 }} className="space-y-6">
          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>¿Qué son las cookies?</h2>
            <p>Las cookies son pequeños archivos de texto que se almacenan en tu navegador cuando visitas un sitio web. Permiten que el sitio recuerde tus preferencias y mejore tu experiencia.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Cookies que utilizamos</h2>
            <p><strong>Cookies técnicas (necesarias):</strong> Autenticación de usuario, preferencias de sesión y consentimiento de cookies.</p>
            <p><strong>Cookies analíticas:</strong> Nos ayudan a entender cómo se usa la plataforma para mejorarla.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>¿Cómo gestionar las cookies?</h2>
            <p>Puedes configurar tu navegador para bloquear o eliminar cookies. También puedes cambiar tus preferencias desde el banner de cookies que aparece al visitar el sitio.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Más información</h2>
            <p>Para cualquier consulta sobre nuestra política de cookies, contacta con nosotros en <a href="mailto:hola@konkabeza.es" style={{ color: "#a5b4fc" }}>hola@konkabeza.es</a>.</p>
            <p>Consulta también nuestra <Link to="/privacidad" style={{ color: "#a5b4fc" }}>Política de Privacidad</Link>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}