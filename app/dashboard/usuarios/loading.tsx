export default function UsuariosLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-5 w-24 rounded bg-slate-200" />
      <div className="mb-6 h-9 w-36 rounded-lg bg-slate-200" />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="h-10 w-full bg-slate-50" />
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-4">
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-4 w-40 rounded bg-slate-100" />
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-4 w-16 rounded bg-slate-100" />
              <div className="h-4 w-20 rounded bg-slate-100" />
              <div className="h-4 w-40 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
