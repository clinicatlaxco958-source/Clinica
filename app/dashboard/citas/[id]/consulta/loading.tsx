export default function ConsultaLoading() {
  return (
    <div className="max-w-lg animate-pulse">
      <div className="mb-4 h-4 w-32 rounded bg-slate-200" />
      <div className="mb-1 h-5 w-24 rounded bg-slate-200" />
      <div className="mb-6 h-3 w-56 rounded bg-slate-100" />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-3 w-16 rounded bg-slate-100" />
        <div className="mt-2 h-4 w-40 rounded bg-slate-200" />
        <div className="mt-2 h-3 w-48 rounded bg-slate-100" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 h-4 w-28 rounded bg-slate-200" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
