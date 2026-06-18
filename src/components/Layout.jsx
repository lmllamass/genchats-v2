/* global __BUILD_TIME__ */
import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Plus, MessageCircle, Shield, Crown, User, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useSubscription } from "@/hooks/useSubscription";
import TrialBanner from "@/components/TrialBanner";

const NAV = [
  { to: "/app", icon: LayoutDashboard, label: "Mis Chatbots" },
  { to: "/nuevo", icon: Plus, label: "Nuevo Chatbot" },
  { to: "/leads", icon: Users, label: "Leads" },
  { to: "/planes", icon: Crown, label: "Planes" },
  { to: "/mi-cuenta", icon: User, label: "Mi cuenta" },
];

export default function Layout() {
  const { isAdmin } = useSubscription();
  return (
    <div className="min-h-screen flex bg-background bg-grid">
      <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen">
        <div className="p-6 border-b border-sidebar-border">
          <Link to="/app" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center glow-purple group-hover:scale-105 transition-transform">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-display font-bold text-foreground tracking-tight leading-none">GenChats</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">IA</div>
              <div className="text-[9px] text-muted-foreground/40 mt-0.5 font-mono">{(() => { try { const d = new Date(__BUILD_TIME__); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`; } catch { return '----'; } })()}</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === "/app"}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${isActive ? "text-foreground bg-sidebar-accent" : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50"}`}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.div layoutId="active-pill" className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-violet-500 to-blue-500 rounded-r" />}
                  <item.icon className="w-4 h-4" /><span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {isAdmin && (
          <div className="p-3 border-t border-sidebar-border">
            <NavLink to="/admin" className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${isActive ? "text-foreground bg-sidebar-accent" : "text-sidebar-foreground hover:text-foreground hover:bg-sidebar-accent/50"}`}>
              <Shield className="w-4 h-4" /><span>Admin</span>
            </NavLink>
          </div>
        )}
        <div className="p-4 border-t border-sidebar-border">
          <div className="text-[11px] text-muted-foreground/70 leading-relaxed">Crea chatbots inteligentes para tu negocio.</div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="md:hidden border-b border-border px-4 py-3 flex items-center justify-between bg-sidebar sticky top-0 z-10">
          <Link to="/app" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-white" /></div>
            <span className="font-display font-bold">GenChats IA</span>
          </Link>
          <Link to="/nuevo" className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium">+ Chatbot</Link>
        </div>
        <TrialBanner />
        <Outlet />
      </main>
    </div>
  );
}