"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/errors";

type PatientResult = { id: string; full_name: string };

// Normaliza para comparar sin importar acentos/mayúsculas ("José" = "Jose").
function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export default function MovementModal({
  open,
  onClose,
  onCreated,
  mode,
  item,
  clinicId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  mode: "entrada" | "salida";
  item: { id: string; name: string; currentStockBoxes: number };
  clinicId: string;
}) {
  const supabase = createClient();
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientResult | null>(
    null
  );
  const [showPopover, setShowPopover] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuantity("");
    setNotes("");
    setError(null);
    setPatientQuery("");
    setPatientResults([]);
    setSelectedPatient(null);
  }, [open]);

  useEffect(() => {
    if (!showPopover) return;
    function handleClickOutside(e: MouseEvent) {
      if (fieldRef.current && !fieldRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPopover]);

  useEffect(() => {
    if (mode !== "salida" || !patientQuery.trim()) {
      setPatientResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name")
        .ilike("full_name_search", `%${normalizeSearch(patientQuery)}%`)
        .order("full_name")
        .limit(8);
      if (!cancelled) setPatientResults(data ?? []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [patientQuery, mode, supabase]);

  if (!open) return null;

  const title = mode === "entrada" ? "Registrar entrada" : "Registrar salida";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const qty = Number(quantity);
    if (!quantity || !Number.isInteger(qty) || qty <= 0) {
      setError("La cantidad de cajas debe ser un número entero mayor a 0.");
      return;
    }
    if (mode === "salida") {
      if (!selectedPatient) {
        setError("Elige el paciente al que se le entrega el medicamento.");
        return;
      }
      if (qty > item.currentStockBoxes) {
        setError(
          `No hay suficiente stock: solo hay ${item.currentStockBoxes} caja(s) disponibles.`
        );
        return;
      }
    }

    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase
      .from("pharmacy_movements")
      .insert({
        clinic_id: clinicId,
        item_id: item.id,
        movement_type: mode,
        quantity_boxes: qty,
        patient_id: mode === "salida" ? selectedPatient!.id : null,
        notes: notes.trim() || null,
        created_by: userData.user!.id,
      });
    setSubmitting(false);

    if (insertError) {
      setError(
        friendlyErrorMessage(
          insertError,
          "No se pudo registrar el movimiento. Intenta de nuevo."
        )
      );
      return;
    }

    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-1 text-base font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          {item.name}
          {mode === "salida" && ` · ${item.currentStockBoxes} caja(s) en stock`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "salida" && (
            <div ref={fieldRef} className="relative">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Paciente
              </label>
              <input
                value={selectedPatient ? selectedPatient.full_name : patientQuery}
                onChange={(e) => {
                  setSelectedPatient(null);
                  setPatientQuery(e.target.value);
                }}
                onFocus={() => setShowPopover(true)}
                placeholder="Buscar paciente..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              {showPopover && patientResults.length > 0 && !selectedPatient && (
                <div className="absolute left-0 top-full z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {patientResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPatient(p);
                        setPatientQuery("");
                        setShowPopover(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {p.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cantidad de cajas
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nota (opcional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                mode === "entrada" ? "Ej. compra a proveedor X" : undefined
              }
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
              {submitting ? "Guardando..." : "Registrar"}
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
