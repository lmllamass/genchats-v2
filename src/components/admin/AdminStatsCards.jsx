export default function AdminStatsCards({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map(s => (
        <div key={s.label} className="rounded-2xl border border-border bg-card/60 backdrop-blur p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-widest">{s.label}</span>
          </div>
          <div className="font-display text-3xl font-bold">{s.value}</div>
        </div>
      ))}
    </div>
  );
}