import { Link, Outlet } from "react-router-dom";
import { MessageCircle, LogOut } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

/**
 * Layout para cuentas de tipo 'operadora': sin barra lateral, sin Nuevo Chatbot, sin Planes
 * ni facturación. Solo la bandeja de entrada — es una cuenta ligera de una persona que
 * atiende conversaciones de un negocio ajeno, no la dueña de una cuenta de genchats.
 */
export default function OperadoraLayout() {
  const { user, logout } = useAuth();

  return (
    // h-screen + overflow-hidden (y no min-h-screen): fija la altura al viewport para que
    // scrollen los paneles internos (lista y mensajes) por separado, en vez de la página.
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <header className="border-b border-border bg-sidebar px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div className="leading-none">
            <div className="font-display font-bold text-foreground tracking-tight">GenChats</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">Bandeja de entrada</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[200px]">{user?.full_name || user?.email}</span>
          <button
            type="button"
            onClick={() => logout("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive px-2.5 py-1.5 rounded-md hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
