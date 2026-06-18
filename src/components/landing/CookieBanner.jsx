import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie_consent");
    if (!consent) setVisible(true);
  }, []);

  const accept = (type) => {
    localStorage.setItem("cookie_consent", type);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
      background: "rgba(10,10,15,0.97)", borderTop: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(12px)", padding: "16px 24px",
    }}>
      <div style={{ maxWidth: "72rem", margin: "0 auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
        <Cookie style={{ width: 20, height: 20, color: "#818cf8", flexShrink: 0 }} />
        <p style={{ flex: 1, fontSize: 13, color: "#94a3b8", lineHeight: 1.6, minWidth: 200 }}>
          Utilizamos cookies propias y de terceros para mejorar tu experiencia, personalizar contenido y analizar el tráfico.
          Al aceptar, consientes el uso de estas tecnologías de acuerdo con nuestra{" "}
          <Link to="/privacidad" style={{ color: "#a5b4fc", textDecoration: "underline" }}>Política de Privacidad</Link> y el RGPD.
        </p>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => accept("necessary")}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "rgba(255,255,255,0.06)", color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
            }}
          >
            Solo necesarias
          </button>
          <button
            onClick={() => accept("all")}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", border: "none",
              cursor: "pointer",
            }}
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}