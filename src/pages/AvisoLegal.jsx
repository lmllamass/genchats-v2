import { Link } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";

const FONT_D = "'Space Grotesk', sans-serif";

export default function AvisoLegal() {
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
        <h1 style={{ fontFamily: FONT_D, fontSize: 32, fontWeight: 700, marginBottom: 32, color: "#fff" }}>Aviso Legal</h1>

        <div style={{ fontSize: 15, color: "#cbd5e1", lineHeight: 1.8 }} className="space-y-6">
          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Titular</h2>
            <p><strong>Konkabeza</strong></p>
            <p>Web: <a href="https://konkabeza.es" target="_blank" rel="noopener noreferrer" style={{ color: "#a5b4fc" }}>konkabeza.es</a></p>
            <p>Email: <a href="mailto:hola@konkabeza.es" style={{ color: "#a5b4fc" }}>hola@konkabeza.es</a></p>
            <p>WhatsApp: <a href="https://wa.me/34689656122" style={{ color: "#a5b4fc" }}>+34 689 656 122</a></p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Objeto</h2>
            <p>GenChats IA es una plataforma de creación de chatbots inteligentes desarrollada por Konkabeza. El uso de esta plataforma implica la aceptación de las condiciones de servicio.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Propiedad intelectual</h2>
            <p>Todos los contenidos, diseños, marcas y código de la plataforma son propiedad de Konkabeza o se utilizan bajo licencia. Queda prohibida su reproducción sin autorización.</p>
          </section>

          <section>
            <h2 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 600, color: "#fff", marginBottom: 8 }}>Legislación aplicable</h2>
            <p>El presente aviso legal se rige por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de España.</p>
          </section>
        </div>
      </main>
    </div>
  );
}