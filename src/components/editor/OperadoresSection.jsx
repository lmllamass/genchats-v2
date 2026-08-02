import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/backendApi";
import { Users, Plus, Trash2, Loader2, Shield, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function OperadoresSection({ proyecto }) {
  const [operadores, setOperadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("operador");
  const [inviting, setInviting] = useState(false);

  const fetchOperadores = useCallback(async () => {
    if (!proyecto?.id) return;
    try {
      const res = await api.listOperadores(proyecto.id);
      setOperadores(res?.operadores || []);
    } catch (_) {
      // proyecto puede no ser accesible aún al montar — silencioso
    } finally {
      setLoading(false);
    }
  }, [proyecto?.id]);

  useEffect(() => { fetchOperadores(); }, [fetchOperadores]);

  const handleInvite = async (e, confirmarClienteExistente = false) => {
    e?.preventDefault();
    if (!email.trim() || inviting) return;
    setInviting(true);
    try {
      const res = await api.invitarOperador({
        proyecto_id: proyecto.id, email: email.trim(), nombre: nombre.trim(), rol,
        ...(confirmarClienteExistente ? { confirmar_cliente_existente: true } : {}),
      });
      toast.success(res?.cuenta_nueva ? "Invitación enviada por email" : "Acceso concedido — se le ha avisado por email");
      setEmail(""); setNombre(""); setRol("operador"); setShowForm(false);
      fetchOperadores();
    } catch (err) {
      // El backend responde 409 'cliente_existente' cuando ese email ya es un cliente:
      // se confirma antes de mezclar los dos papeles en la misma cuenta.
      if (err.message === "cliente_existente") {
        setInviting(false);
        if (confirm(`${email.trim()} ya es un cliente de la plataforma.\n\nSi continúas, conservará su cuenta de cliente y además podrá atender este proyecto.\n\n¿Continuar?`)) {
          return handleInvite(null, true);
        }
        return;
      }
      toast.error("Error: " + err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleToggleActivo = async (op) => {
    try {
      await api.updateOperador(op.id, { activo: !op.activo });
      setOperadores(prev => prev.map(o => o.id === op.id ? { ...o, activo: !o.activo } : o));
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  const handleToggleRol = async (op) => {
    const nuevoRol = op.rol === "supervisor" ? "operador" : "supervisor";
    try {
      await api.updateOperador(op.id, { rol: nuevoRol });
      setOperadores(prev => prev.map(o => o.id === op.id ? { ...o, rol: nuevoRol } : o));
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  const handleDelete = async (op) => {
    if (!confirm(`¿Quitar el acceso de ${op.email} a este proyecto?`)) return;
    try {
      await api.deleteOperador(op.id);
      setOperadores(prev => prev.filter(o => o.id !== op.id));
    } catch (err) {
      toast.error("Error: " + err.message);
    }
  };

  if (loading) return null;

  return (
    <div className="p-5 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Operadoras
        </h3>
        <button onClick={() => setShowForm(v => !v)} className="text-xs text-primary hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> Invitar
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
        Personas que pueden atender las conversaciones y leads de este proyecto, sin acceso a facturación ni configuración.
      </p>

      {showForm && (
        <form onSubmit={handleInvite} className="space-y-2 mb-3 p-3 rounded-lg bg-secondary/30 border border-border">
          <Input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@ejemplo.com" className="h-8 text-xs bg-secondary/50" required />
          <Input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (opcional)" className="h-8 text-xs bg-secondary/50" />
          <div className="flex items-center gap-2">
            <select value={rol} onChange={e => setRol(e.target.value)} className="h-8 text-xs rounded-md bg-secondary/50 border border-border px-2 flex-1">
              <option value="operador">Operadora</option>
              <option value="supervisor">Supervisora (puede invitar a otras)</option>
            </select>
            <Button type="submit" size="sm" className="h-8 text-xs shrink-0" disabled={inviting}>
              {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Enviar"}
            </Button>
          </div>
        </form>
      )}

      {operadores.length === 0 ? (
        <p className="text-[11px] text-muted-foreground text-center py-3">Sin operadoras todavía.</p>
      ) : (
        <div className="space-y-1.5">
          {operadores.map(op => (
            <div key={op.id} className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs ${op.activo ? "bg-secondary/30" : "bg-secondary/10 opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{op.nombre || op.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{op.email}</p>
              </div>
              <button
                onClick={() => handleToggleRol(op)}
                title={op.rol === "supervisor" ? "Supervisora — clic para pasar a operadora" : "Operadora — clic para pasar a supervisora"}
                className={`p-1 rounded shrink-0 ${op.rol === "supervisor" ? "text-violet-400" : "text-muted-foreground"}`}
              >
                {op.rol === "supervisor" ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleToggleActivo(op)}
                title={op.activo ? "Desactivar acceso" : "Reactivar acceso"}
                className="text-[10px] px-1.5 py-0.5 rounded border border-border shrink-0"
              >
                {op.activo ? "Activa" : "Inactiva"}
              </button>
              <button onClick={() => handleDelete(op)} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
