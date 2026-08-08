import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/backendApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Plus, Trash2, Loader2, MapPin, X, Clock , Pencil} from "lucide-react";
import { toast } from "sonner";
import ExportButton from "@/components/ExportButton";

const DIAS = [
  { n: 1, corto: "L" }, { n: 2, corto: "M" }, { n: 3, corto: "X" },
  { n: 4, corto: "J" }, { n: 5, corto: "V" }, { n: 6, corto: "S" }, { n: 7, corto: "D" },
];

const ESTADO_CLS = {
  confirmada:   "bg-green-500/10 text-green-400 border-green-500/20",
  cancelada:    "bg-gray-500/10 text-gray-400 border-gray-500/20",
  lista_espera: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completada:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  no_show:      "bg-red-500/10 text-red-400 border-red-500/20",
};


/**
 * Edición en línea de una sede. Sustituye a la tarjeta mientras se edita, en vez
 * de abrir un diálogo: son cuatro campos y el contexto de alrededor —los
 * horarios— importa para decidir.
 */
function RecursoEditor({ recurso, onGuardado, onCancelar }) {
  const m = recurso.metadata || {};
  const [form, setForm] = useState({
    nombre: recurso.nombre || "",
    direccion: recurso.direccion || "",
    calendar_id: recurso.calendar_id || "",
    aforo: recurso.aforo ?? "",
    alias_calendario: (m.alias_calendario || []).join(", "),
    alias_alumnos: m.alias_alumnos || "",
    reserva_online: m.reserva_online !== false,
  });
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!form.nombre.trim()) return toast.error("Ponle un nombre");
    setGuardando(true);
    try {
      const { alias_calendario, alias_alumnos, reserva_online, ...campos } = form;
      await api.actualizarRecurso(recurso.id, {
        ...campos,
        aforo: form.aforo === "" ? null : Number(form.aforo),
        metadata: { alias_calendario, alias_alumnos, reserva_online },
      });
      toast.success("Sede actualizada");
      onGuardado();
    } catch (err) {
      toast.error(err?.message || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const campo = (clave, props) => (
    <Input value={form[clave]} onChange={e => setForm(f => ({ ...f, [clave]: e.target.value }))}
      className="h-8 text-xs" {...props} />
  );

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 space-y-2">
      {campo("nombre", { placeholder: "Nombre" })}
      {campo("direccion", { placeholder: "Dirección (opcional)" })}
      {campo("aforo", { placeholder: "Aforo — plazas totales (opcional)", type: "number", min: "1" })}
      {campo("calendar_id", { placeholder: "ID de Google Calendar (opcional)" })}

      <div className="pt-2 border-t border-border/60 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Si la disponibilidad vive en un fichero del cliente
        </p>
        {campo("alias_calendario", { placeholder: "Cómo se llama en su calendario (separa con comas)" })}
        {campo("alias_alumnos", { placeholder: "Cómo se llama en su listado (ej. FUENLA)" })}
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={form.reserva_online}
            onChange={e => setForm(f => ({ ...f, reserva_online: e.target.checked }))}
            className="mt-0.5 accent-primary" />
          <span className="text-[11px] leading-snug">
            El chatbot puede reservar aquí
            <span className="block text-[10px] text-muted-foreground">
              Si lo desmarcas, dirá que un compañero se encarga de esta sede en vez de decir
              que no hay plazas.
            </span>
          </span>
        </label>
      </div>

      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={guardar} disabled={guardando}>
          {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  );
}


function FranjasDeRecurso({ recurso, onCambio }) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ dias: [], hora: "", capacidad: "", duracion_min: "60", etiqueta: "" });
  const [guardando, setGuardando] = useState(false);

  const toggleDia = (n) =>
    setForm(f => ({ ...f, dias: f.dias.includes(n) ? f.dias.filter(d => d !== n) : [...f.dias, n] }));

  const guardar = async () => {
    setGuardando(true);
    try {
      await api.crearFranjas({ recurso_id: recurso.id, ...form });
      toast.success("Horario añadido");
      setForm({ dias: [], hora: "", capacidad: "", duracion_min: "60", etiqueta: "" });
      setAbierto(false);
      onCambio();
    } catch (err) {
      toast.error(err?.message || "No se pudo añadir el horario");
    } finally {
      setGuardando(false);
    }
  };

  const borrar = async (id) => {
    try {
      await api.borrarFranja(id);
      onCambio();
    } catch (err) {
      toast.error(err?.message || "No se pudo borrar");
    }
  };

  // Agrupa por hora para no repetir "13:00" siete veces (una por día)
  const porHora = new Map();
  for (const f of recurso.reservas_franjas || []) {
    const clave = `${String(f.hora).slice(0, 5)}|${f.capacidad}`;
    if (!porHora.has(clave)) porHora.set(clave, []);
    porHora.get(clave).push(f);
  }

  return (
    <div className="mt-3 space-y-2">
      {porHora.size === 0 && !abierto && (
        <p className="text-xs text-muted-foreground">
          Sin horarios. Sin al menos uno, el agente no podrá reservar nada aquí.
        </p>
      )}

      {[...porHora.entries()].map(([clave, franjas]) => {
        const [hora, capacidad] = clave.split("|");
        const dias = franjas.map(f => f.dia_semana).sort();
        return (
          <div key={clave} className="flex items-center gap-2 text-xs bg-secondary/40 rounded-lg px-2.5 py-1.5">
            <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="font-medium tabular-nums">{hora}</span>
            <span className="text-muted-foreground">
              {DIAS.filter(d => dias.includes(d.n)).map(d => d.corto).join("")}
            </span>
            <span className="text-muted-foreground">· {capacidad} plazas</span>
            {franjas[0].etiqueta && <span className="text-muted-foreground truncate">· {franjas[0].etiqueta}</span>}
            <button
              onClick={() => franjas.forEach(f => borrar(f.id))}
              className="ml-auto text-muted-foreground hover:text-destructive shrink-0"
              title="Borrar este horario"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      {abierto ? (
        <div className="rounded-lg border border-border p-3 space-y-2.5">
          <div className="flex gap-1">
            {DIAS.map(d => (
              <button
                key={d.n}
                onClick={() => toggleDia(d.n)}
                className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${
                  form.dias.includes(d.n)
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                }`}
              >
                {d.corto}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
              className="h-8 text-xs" placeholder="Hora" />
            <Input type="number" min="1" value={form.capacidad}
              onChange={e => setForm(f => ({ ...f, capacidad: e.target.value }))}
              className="h-8 text-xs" placeholder="Plazas (aforo)" />
            <Input type="number" min="15" step="15" value={form.duracion_min}
              onChange={e => setForm(f => ({ ...f, duracion_min: e.target.value }))}
              className="h-8 text-xs" placeholder="Duración (min)" />
            <Input value={form.etiqueta} onChange={e => setForm(f => ({ ...f, etiqueta: e.target.value }))}
              className="h-8 text-xs" placeholder="Etiqueta (Comida…)" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={guardar} disabled={guardando}>
              {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Guardar"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAbierto(true)}>
          <Plus className="w-3 h-3 mr-1" /> Añadir horario
        </Button>
      )}
    </div>
  );
}

export default function ReservasSection({ proyecto }) {
  const proyectoId = proyecto?.id;
  const qc = useQueryClient();
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [nuevo, setNuevo] = useState({
    nombre: "", direccion: "", calendar_id: "", aforo: "",
    alias_calendario: "", alias_alumnos: "", reserva_online: true,
  });
  const [creando, setCreando] = useState(false);

  const { data: recursosData, isLoading, refetch } = useQuery({
    queryKey: ["reservas-recursos", proyectoId],
    queryFn: () => api.listarRecursos(proyectoId),
    enabled: !!proyectoId,
  });
  const recursos = recursosData?.recursos || [];

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: reservasData, refetch: refetchReservas } = useQuery({
    queryKey: ["reservas-lista", proyectoId],
    queryFn: () => api.listarReservas(proyectoId, { desde: hoy }),
    enabled: !!proyectoId,
  });
  const reservas = reservasData?.reservas || [];

  const recargar = () => { refetch(); refetchReservas(); qc.invalidateQueries({ queryKey: ["reservas-lista"] }); };

  const crearRecurso = async () => {
    if (!nuevo.nombre.trim()) return toast.error("Ponle un nombre");
    setCreando(true);
    try {
      const { alias_calendario, alias_alumnos, reserva_online, ...campos } = nuevo;
      await api.crearRecurso({
        proyecto_id: proyectoId,
        ...campos,
        metadata: { alias_calendario, alias_alumnos, reserva_online },
      });
      toast.success("Recurso creado");
      setNuevo({ nombre: "", direccion: "", calendar_id: "", aforo: "",
        alias_calendario: "", alias_alumnos: "", reserva_online: true });
      setNuevoAbierto(false);
      refetch();
    } catch (err) {
      toast.error(err?.message || "No se pudo crear");
    } finally {
      setCreando(false);
    }
  };

  const borrarRecurso = async (r) => {
    if (!window.confirm(`¿Eliminar "${r.nombre}" con sus horarios y reservas?`)) return;
    try {
      await api.borrarRecurso(r.id);
      toast.success("Recurso eliminado");
      recargar();
    } catch (err) {
      // El backend devuelve 409 si hay reservas confirmadas: pedimos confirmación extra
      if (err?.message?.includes("reserva")) {
        if (window.confirm(`${err.message}\n\n¿Continuar de todas formas?`)) {
          try {
            await api.borrarRecurso(r.id, true);
            toast.success("Recurso eliminado");
            recargar();
          } catch (e2) { toast.error(e2?.message || "No se pudo eliminar"); }
        }
        return;
      }
      toast.error(err?.message || "No se pudo eliminar");
    }
  };

  const cancelar = async (reserva) => {
    if (!window.confirm(`¿Cancelar la reserva ${reserva.codigo}? La plaza quedará libre.`)) return;
    try {
      await api.cancelarReserva(reserva.codigo, proyectoId, "Cancelada desde el panel");
      toast.success(`Reserva ${reserva.codigo} cancelada`);
      recargar();
    } catch (err) {
      toast.error(err?.message || "No se pudo cancelar");
    }
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reservas</h4>
        <ExportButton tipo="reservas" proyectoId={proyectoId} size="sm" variant="ghost" label="CSV" />
      </div>

      {/* ── Recursos y horarios ── */}
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground leading-snug">
          Un <strong>recurso</strong> es cada sede, local o sala. Sus <strong>horarios</strong> definen
          qué se puede reservar y cuántas plazas hay en cada uno.
        </p>

        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}

        {!isLoading && recursos.length === 0 && !nuevoAbierto && (
          <div className="rounded-xl bg-secondary/30 border border-border p-4 text-center space-y-3">
            <CalendarDays className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs text-muted-foreground">
              Todavía no hay recursos. Crea el primero para que el agente pueda reservar.
            </p>
          </div>
        )}

        {recursos.map(r => (
          editandoId === r.id
            ? <RecursoEditor key={r.id} recurso={r}
                onGuardado={() => { setEditandoId(null); refetch(); }}
                onCancelar={() => setEditandoId(null)} />
            : (
          <div key={r.id} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.nombre}</p>
                {r.direccion && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />{r.direccion}
                  </p>
                )}
                {r.metadata?.reserva_online === false && (
                  <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/20">
                    la lleva un compañero
                  </span>
                )}
                {r.aforo && (
                  <p className="text-[10px] text-muted-foreground">aforo: {r.aforo} plazas</p>
                )}
                {r.metadata?.alias_calendario?.length > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    en su calendario: {r.metadata.alias_calendario.join(", ")}
                  </p>
                )}
                {r.calendar_id && (
                  <p className="text-[11px] text-muted-foreground truncate">📅 {r.calendar_id}</p>
                )}
              </div>
              <button onClick={() => borrarRecurso(r)}
                className="text-muted-foreground hover:text-destructive shrink-0" title="Eliminar recurso">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditandoId(r.id)}
                className="text-muted-foreground hover:text-foreground shrink-0" title="Editar">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
            <FranjasDeRecurso recurso={r} onCambio={recargar} />
          </div>
        )))}

        {nuevoAbierto ? (
          <div className="rounded-xl border border-border p-3 space-y-2">
            <Input value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))}
              placeholder="Nombre (ej. Local Centro)" className="h-8 text-xs" />
            <Input value={nuevo.direccion} onChange={e => setNuevo(n => ({ ...n, direccion: e.target.value }))}
              placeholder="Dirección (opcional)" className="h-8 text-xs" />
            <Input value={nuevo.aforo} onChange={e => setNuevo(n => ({ ...n, aforo: e.target.value }))}
              placeholder="Aforo — plazas totales (opcional)" type="number" min="1" className="h-8 text-xs" />
            <Input value={nuevo.calendar_id} onChange={e => setNuevo(n => ({ ...n, calendar_id: e.target.value }))}
              placeholder="ID de Google Calendar (opcional)" className="h-8 text-xs" />
            <p className="text-[10px] text-muted-foreground leading-snug">
              Si pones un calendario, cada reserva creará su evento y se moverá o borrará al
              cambiarla o cancelarla. Recuerda compartirlo con la cuenta de servicio.
            </p>

            <div className="pt-2 border-t border-border/60 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Si la disponibilidad vive en un fichero del cliente
              </p>
              <Input value={nuevo.alias_calendario}
                onChange={e => setNuevo(n => ({ ...n, alias_calendario: e.target.value }))}
                placeholder="Cómo se llama en su calendario (separa con comas)" className="h-8 text-xs" />
              <Input value={nuevo.alias_alumnos}
                onChange={e => setNuevo(n => ({ ...n, alias_alumnos: e.target.value }))}
                placeholder="Cómo se llama en su listado (ej. FUENLA)" className="h-8 text-xs" />
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={nuevo.reserva_online}
                  onChange={e => setNuevo(n => ({ ...n, reserva_online: e.target.checked }))}
                  className="mt-0.5 accent-primary" />
                <span className="text-[11px] leading-snug">
                  El chatbot puede reservar aquí
                  <span className="block text-[10px] text-muted-foreground">
                    Si lo desmarcas, dirá que un compañero se encarga de esta sede en vez de
                    decir que no hay plazas.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={crearRecurso} disabled={creando}>
                {creando ? <Loader2 className="w-3 h-3 animate-spin" /> : "Crear"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setNuevoAbierto(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setNuevoAbierto(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Añadir recurso
          </Button>
        )}
      </div>

      {/* ── Próximas reservas ── */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Próximas reservas {reservas.length > 0 && `(${reservas.length})`}
        </h4>
        {reservas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin reservas de hoy en adelante.</p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {reservas.map(r => (
              <div key={r.id} className="rounded-lg bg-secondary/40 px-2.5 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{r.codigo}</span>
                  <Badge variant="outline" className={`text-[10px] ${ESTADO_CLS[r.estado] || ""}`}>
                    {r.estado}
                  </Badge>
                  {r.estado === "confirmada" && (
                    <button onClick={() => cancelar(r)}
                      className="ml-auto text-muted-foreground hover:text-destructive" title="Cancelar reserva">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-muted-foreground mt-0.5">
                  {r.fecha} · {String(r.hora).slice(0, 5)} · {r.reservas_recursos?.nombre}
                  {r.unidades > 1 && ` · ${r.unidades} plazas`}
                </p>
                <p className="text-muted-foreground truncate">
                  {r.nombre_cliente || "Sin nombre"}{r.telefono_cliente ? ` · ${r.telefono_cliente}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
