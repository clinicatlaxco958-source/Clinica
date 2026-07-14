export default function PerfilLoading() {
  return (
    <div className="max-w-md animate-pulse space-y-6">
      <div>
        <div className="mb-6 h-5 w-24 rounded bg-slate-200" />
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-16 rounded bg-slate-100" />
              <div className="mt-2 h-4 w-40 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
