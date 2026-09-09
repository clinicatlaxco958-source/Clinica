"use client";

export default function PrintSettingsModal({
  printCopy,
  onPrintCopyChange,
  halfPage,
  onHalfPageChange,
  printCopyFooter,
  onPrintCopyFooterChange,
  onClose,
}: {
  printCopy: boolean;
  onPrintCopyChange: (value: boolean) => void;
  halfPage: boolean;
  onHalfPageChange: (value: boolean) => void;
  printCopyFooter: boolean;
  onPrintCopyFooterChange: (value: boolean) => void;
  onClose: () => void;
}) {
  const sizeHint = halfPage
    ? printCopy
      ? "Original y copia caben juntas en la misma hoja."
      : "Deja espacio libre en la mitad inferior de la hoja."
    : printCopy
    ? "La copia se imprime en una hoja aparte."
    : null;

  return (
    <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-sm shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Ajustes de impresión
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={printCopy}
              onChange={(e) => onPrintCopyChange(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-slate-700">Imprimir copia</span>
          </label>

          <div>
            <p className="mb-1 font-medium text-slate-700">
              Tamaño de receta
            </p>
            <div className="space-y-1">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="receta-size"
                  checked={!halfPage}
                  onChange={() => onHalfPageChange(false)}
                  className="h-4 w-4 border-slate-300"
                />
                <span className="text-slate-700">Hoja completa</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="receta-size"
                  checked={halfPage}
                  onChange={() => onHalfPageChange(true)}
                  className="h-4 w-4 border-slate-300"
                />
                <span className="text-slate-700">Media hoja</span>
              </label>
            </div>
            {sizeHint && (
              <p className="mt-1 text-xs text-slate-500">{sizeHint}</p>
            )}
          </div>

          <label
            className={`flex items-center gap-2 ${
              !printCopy ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={printCopyFooter}
              onChange={(e) => onPrintCopyFooterChange(e.target.checked)}
              disabled={!printCopy}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span className="text-slate-700">Imprimir footer de copia</span>
          </label>
          <p className="-mt-3 text-xs text-slate-500">
            Marca el original como "Copia paciente" y la copia como "Copia
            doctor" para distinguirlas.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
