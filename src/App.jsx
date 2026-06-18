import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Landing from '@/pages/Landing.jsx';
import Login from '@/pages/Login';
import ResetPassword from '@/pages/ResetPassword';
import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import NuevoProyecto from '@/pages/NuevoProyecto';
import Editor from '@/pages/Editor';
import Exportar from '@/pages/Exportar';
import Planes from '@/pages/Planes';
import MiCuenta from '@/pages/MiCuenta';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminUsuarios from '@/pages/admin/AdminUsuarios';
import AdminProyectos from '@/pages/admin/AdminProyectos';
import AdminLogs from '@/pages/admin/AdminLogs';
import AdminConfig from '@/pages/admin/AdminConfig';
import AdminConfiguracion from '@/pages/admin/AdminConfiguracion';
import AdminProyectoDetalle from '@/pages/admin/AdminProyectoDetalle';
import DeployAgent from '@/pages/admin/DeployAgent';
import ChatbotPublic from '@/pages/ChatbotPublic';
import Asistente from '@/pages/Asistente';
import Demo from '@/pages/Demo';
import Privacidad from '@/pages/Privacidad.jsx';
import Cookies from '@/pages/Cookies.jsx';
import AvisoLegal from '@/pages/AvisoLegal.jsx';
import Activacion from '@/pages/Activacion';
import Conversaciones from '@/pages/Conversaciones';
import Leads from '@/pages/Leads';
import Debug from '@/pages/Debug';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  const isLoading = isLoadingAuth;

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<Layout />}>
        <Route path="/app" element={isLoading ? <LoadingScreen /> : <Dashboard />} />
        <Route path="/nuevo" element={isLoading ? <LoadingScreen /> : <NuevoProyecto />} />
        <Route path="/exportar/:id" element={isLoading ? <LoadingScreen /> : <Exportar />} />
        <Route path="/planes" element={isLoading ? <LoadingScreen /> : <Planes />} />
        <Route path="/mi-cuenta" element={isLoading ? <LoadingScreen /> : <MiCuenta />} />
        <Route path="/conversaciones" element={isLoading ? <LoadingScreen /> : <Conversaciones />} />
        <Route path="/leads" element={isLoading ? <LoadingScreen /> : <Leads />} />
      </Route>
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={isLoading ? <LoadingScreen /> : <AdminDashboard />} />
        <Route path="/admin/usuarios" element={isLoading ? <LoadingScreen /> : <AdminUsuarios />} />
        <Route path="/admin/proyectos" element={isLoading ? <LoadingScreen /> : <AdminProyectos />} />
        <Route path="/admin/logs" element={isLoading ? <LoadingScreen /> : <AdminLogs />} />
        <Route path="/admin/config" element={isLoading ? <LoadingScreen /> : <AdminConfig />} />
        <Route path="/admin/configuracion" element={isLoading ? <LoadingScreen /> : <AdminConfiguracion />} />
        <Route path="/admin/proyectos/:id" element={isLoading ? <LoadingScreen /> : <AdminProyectoDetalle />} />
        <Route path="/admin/deploy-agent" element={isLoading ? <LoadingScreen /> : <DeployAgent />} />
      </Route>
      <Route path="/editor/:id" element={isLoading ? <LoadingScreen /> : <Editor />} />
      <Route path="/activacion" element={isLoading ? <LoadingScreen /> : <Activacion />} />
      <Route path="/chat/:id" element={<ChatbotPublic />} />
      <Route path="/asistente" element={<Asistente />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/privacidad" element={<Privacidad />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/aviso-legal" element={<AvisoLegal />} />
      <Route path="/debug" element={<Debug />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function LoadingScreen() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 32, height: 32, border: "4px solid rgba(139,92,246,0.3)", borderTopColor: "#8b5cf6", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <Sonner position="bottom-right" theme="dark" />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App