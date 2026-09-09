"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/errors";

export default function AddMedicationModal({
  open,
  onClose,
  onCreated,
  clinicId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  clinicId: string;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [boxDescription, setBoxDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre del medicamento es obligatorio.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase.from("pharmacy_items").insert({
      clinic_id: clinicId,
      name: name.trim(),
      box_description: boxDescription.trim() || null,
    });
    setSubmitting(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Ya existe un medicamento con ese nombre en el catálogo."
          : friendlyErrorMessage(
              insertError,
              "No se pudo guardar el medicamento. Intenta de nuevo."
            )
      );
      return;
    }

    setName("");
    setBoxDescription("");
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Nuevo medicamento
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nombre
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Descripción de la caja (opcional)
            </label>
            <input
              placeholder="Ej. Caja con 20 tabletas 500mg"
              value={boxDescription}
              onChange={(e) => setBoxDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : "Agregar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
