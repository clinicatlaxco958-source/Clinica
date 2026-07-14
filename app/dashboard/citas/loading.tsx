export default function CitasLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-5 w-24 rounded bg-slate-200" />
          <div className="mt-2 h-3 w-40 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-48 rounded-lg bg-slate-200" />
      </div>

      <div className="h-[650px] rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-8 w-full rounded bg-slate-100" />
        <div className="mt-4 h-[580px] w-full rounded bg-slate-50" />
      </div>
    </div>
  );
}
