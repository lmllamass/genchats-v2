/* global __BUILD_TIME__ */
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, FileCode, Activity, Settings, ArrowLeft, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect } from "react";

const NAV = [
  { to: "/admin", icon: LayoutDashboard, label: "Panel Admin" },
  { to: "/admin/usuarios", icon: Users, label: "Usuarios" },
  { to: "/admin/proyectos", icon: FileCode, label: "Proyectos" },
  { to: "/admin/logs", icon: Activity, label: "Log Actividad" },
  { to: "/admin/configuracion", icon: Settings, label: "Configuración" },
];

function buildLabel() {
  try {
    const d = new Date(__BUILD_TIME__);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}${dd}-${hh}${min}`;
  } catch { return '----'; }
}

export default function AdminLayout() {
  const { isAdmin, loading } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) navigate("/");
  }, [loading, isAdmin, navigate]);

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen flex bg-background bg-grid">
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar/60 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-foreground tracking-tight leading-none">Admin</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">GenChats IA</div>
              <div className="text-[9px] text-muted-foreground/40 mt-0.5 font-mono">{buildLabel()}</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${isActive ? "text-foreground bg-sidebar-accent" : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50"}`}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.div layoutId="admin-pill" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-amber-500 to-orange-500 rounded-r" />}
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="p-3">
          <Link to="/" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50">
            <ArrowLeft className="w-4 h-4" /> Volver a la app
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}