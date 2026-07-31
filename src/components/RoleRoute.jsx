import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

const Spinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
  </div>
);

/**
 * Encamina según el tipo de cuenta.
 *
 * @param {'cliente'|'operadora'} permite - tipo de cuenta que puede pasar.
 *
 * Espera a `profileLoaded` a propósito: el tipo_cuenta vive en user_profiles y llega
 * asíncrono. Sin esa espera, una operadora vería un salto a /app antes de ir a su inbox
 * (por defecto se asume 'cliente' mientras no hay perfil).
 */
export default function RoleRoute({ permite }) {
  const { user, profileLoaded, isLoadingAuth } = useAuth();

  if (isLoadingAuth || !profileLoaded) return <Spinner />;

  const tipo = user?.tipo_cuenta || "cliente";
  if (tipo === permite) return <Outlet />;

  return <Navigate to={tipo === "operadora" ? "/inbox" : "/app"} replace />;
}
