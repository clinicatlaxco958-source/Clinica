"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PresentationValue =
  | "tableta"
  | "capsula"
  | "jarabe"
  | "gotas"
  | "inyeccion"
  | "crema"
  | "otro";

const PRESENTATIONS: {
  value: PresentationValue;
  label: string;
  verb: string;
  unitSingular: string;
  unitPlural: string;
  needsQuantity: boolean;
}[] = [
  {
    value: "tableta",
    label: "Tableta",
    verb: "Tomar",
    unitSingular: "tableta",
    unitPlural: "tabletas",
    needsQuantity: true,
  },
  {
    value: "capsula",
    label: "Cápsula",
    verb: "Tomar",
    unitSingular: "cápsula",
    unitPlural: "cápsulas",
    needsQuantity: true,
  },
  {
    value: "jarabe",
    label: "Jarabe/Suspensión (mL)",
    verb: "Tomar",
    unitSingular: "mL",
    unitPlural: "mL",
    needsQuantity: true,
  },
  {
    value: "gotas",
    label: "Gotas",
    verb: "Aplicar",
    unitSingular: "gota",
    unitPlural: "gotas",
    needsQuantity: true,
  },
  {
    value: "inyeccion",
    label: "Inyección/Ampolleta",
    verb: "Aplicar",
    unitSingular: "ampolleta",
    unitPlural: "ampolletas",
    needsQuantity: true,
  },
  {
    value: "crema",
    label: "Crema/Ungüento",
    verb: "Aplicar",
    unitSingular: "",
    unitPlural: "",
    needsQuantity: false,
  },
  {
    value: "otro",
    label: "Otro (instrucción libre)",
    verb: "",
    unitSingular: "",
    unitPlural: "",
    needsQuantity: false,
  },
];

type MedicationRow = {
  medicationName: string;
  presentation: PresentationValue;
  quantity: string;
  customInstruction: string;
  frequencyHours: string;
  durationDays: string;
};

function formatDose(m: MedicationRow) {
  const preset =
    PRESENTATIONS.find((p) => p.value === m.presentation) ?? PRESENTATIONS[0];

  if (m.presentation === "otro") {
    return m.customInstruction.trim();
  }
  if (!preset.needsQuantity) {
    return preset.verb;
  }
  const qty = m.quantity || "1";
  const unit = Number(qty) === 1 ? preset.unitSingular : preset.unitPlural;
  return `${preset.verb} ${qty} ${unit}`;
}

function emptyMedication(): MedicationRow {
  return {
    medicationName: "",
    presentation: "tableta",
    quantity: "",
    customInstruction: "",
    frequencyHours: "",
    durationDays: "",
  };
}

export default function ConsultationForm({
  appointmentId,
  clinicId,
  canEditNotes,
  initialWeightKg,
  initialHeightCm,
  initialTemperatureC,
  initialBloodPressure,
  initialNotes,
  initialMedications,
  clinicName,
  patientName,
  doctorName,
  date,
}: {
  appointmentId: string;
  clinicId: string;
  canEditNotes: boolean;
  initialWeightKg: number | null;
  initialHeightCm: number | null;
  initialTemperatureC: number | null;
  initialBloodPressure: string | null;
  initialNotes: string | null;
  initialMedications: MedicationRow[];
  clinicName: string;
  patientName: string;
  doctorName: string;
  date: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [weight, setWeight] = useState(
    initialWeightKg != null ? String(initialWeightKg) : ""
  );
  const [height, setHeight] = useState(
    initialHeightCm != null ? String(initialHeightCm) : ""
  );
  const [temperature, setTemperature] = useState(
    initialTemperatureC != null ? String(initialTemperatureC) : ""
  );
  const [bloodPressure, setBloodPressure] = useState(
    initialBloodPressure ?? ""
  );
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [medications, setMedications] = useState<MedicationRow[]>(
    initialMedications.length > 0 ? initialMedications : [emptyMedication()]
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMedication(
    index: number,
    field: keyof MedicationRow,
    value: string
  ) {
    setMedications((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  function addMedication() {
    setMedications((rows) => [...rows, emptyMedication()]);
  }

  function removeMedication(index: number) {
    setMedications((rows) => rows.filter((_, i) => i !== index));
  }

  const validMedications = medications.filter((m) => m.medicationName.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    for (const m of medications) {
      const hasAny =
        m.medicationName.trim() ||
        m.frequencyHours ||
        m.durationDays ||
        m.quantity ||
        m.customInstruction.trim();
      if (!hasAny) continue;

      if (!m.medicationName.trim() || !m.frequencyHours || !m.durationDays) {
        setSaving(false);
        setError(
          "Completa nombre, frecuencia y días de cada medicamento (o bórralo)."
        );
        return;
      }

      const preset = PRESENTATIONS.find((p) => p.value === m.presentation);
      if (m.presentation === "otro" && !m.customInstruction.trim()) {
        setSaving(false);
        setError(
          "Escribe la instrucción de dosis para el medicamento marcado como 'Otro'."
        );
        return;
      }
      if (preset?.needsQuantity && !m.quantity) {
        setSaving(false);
        setError(
          `Indica la cantidad de "${m.medicationName}" (ej. cuántas tabletas/mL/gotas).`
        );
        return;
      }
    }

    const payload: Record<string, unknown> = {
      appointment_id: appointmentId,
      clinic_id: clinicId,
      weight_kg: weight ? Number(weight) : null,
      height_cm: height ? Number(height) : null,
      temperature_c: temperature ? Number(temperature) : null,
      blood_pressure: bloodPressure.trim() || null,
      updated_at: new Date().toISOString(),
    };
    // Quien no es el doctor de la cita no envía `notes`, así nunca borra
    // ni sobrescribe las notas clínicas del doctor.
    if (canEditNotes) {
      payload.notes = notes.trim() || null;
    }

    const { error: upsertError } = await supabase
      .from("consultations")
      .upsert(payload, { onConflict: "appointment_id" });

    if (upsertError) {
      setSaving(false);
      setError(upsertError.message);
      return;
    }

    if (canEditNotes) {
      // Reemplaza la lista completa (simple, listas cortas) en vez de
      // diffear altas/bajas/ediciones una por una.
      const { error: deleteError } = await supabase
        .from("prescription_items")
        .delete()
        .eq("appointment_id", appointmentId);

      if (deleteError) {
        setSaving(false);
        setError(deleteError.message);
        return;
      }

      if (validMedications.length > 0) {
        const { error: insertError } = await supabase
          .from("prescription_items")
          .insert(
            validMedications.map((m) => ({
              appointment_id: appointmentId,
              clinic_id: clinicId,
              medication_name: m.medicationName.trim(),
              presentation: m.presentation,
              quantity: m.quantity ? Number(m.quantity) : null,
              custom_instruction: m.customInstruction.trim() || null,
              frequency_hours: Number(m.frequencyHours),
              duration_days: Number(m.durationDays),
            }))
          );

        if (insertError) {
          setSaving(false);
          setError(insertError.message);
          return;
        }
      }
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  const vitalsAndNotes = (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm"
    >
      <h2 className="text-sm font-semibold text-slate-900">
        Signos vitales
      </h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Peso (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Talla (cm)
          </label>
          <input
            type="number"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Temperatura (°C)
          </label>
          <input
            type="number"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Presión arterial
          </label>
          <input
            placeholder="120/80"
            value={bloodPressure}
            onChange={(e) => setBloodPressure(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {canEditNotes && (
        <>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-900">
              Notas de consulta
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Diagnóstico, tratamiento, indicaciones..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-900">
              Tratamiento
            </label>
            <div className="space-y-3">
              {medications.map((m, i) => {
                const preset = PRESENTATIONS.find(
                  (p) => p.value === m.presentation
                )!;
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <input
                        placeholder="Medicamento"
                        value={m.medicationName}
                        onChange={(e) =>
                          updateMedication(
                            i,
                            "medicationName",
                            e.target.value
                          )
                        }
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <select
                        value={m.presentation}
                        onChange={(e) =>
                          updateMedication(
                            i,
                            "presentation",
                            e.target.value
                          )
                        }
                        className="w-44 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                      >
                        {PRESENTATIONS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeMedication(i)}
                        className="rounded-lg px-2 py-2 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                        aria-label="Quitar medicamento"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      {m.presentation === "otro" ? (
                        <input
                          placeholder="Instrucción de dosis (ej. aplicar una capa delgada)"
                          value={m.customInstruction}
                          onChange={(e) =>
                            updateMedication(
                              i,
                              "customInstruction",
                              e.target.value
                            )
                          }
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      ) : preset.needsQuantity ? (
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          placeholder={`Cantidad (${preset.unitSingular})`}
                          value={m.quantity}
                          onChange={(e) =>
                            updateMedication(i, "quantity", e.target.value)
                          }
                          className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        />
                      ) : null}
                      <input
                        type="number"
                        min={1}
                        placeholder="Cada (hrs)"
                        value={m.frequencyHours}
                        onChange={(e) =>
                          updateMedication(
                            i,
                            "frequencyHours",
                            e.target.value
                          )
                        }
                        className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="Días"
                        value={m.durationDays}
                        onChange={(e) =>
                          updateMedication(i, "durationDays", e.target.value)
                        }
                        className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addMedication}
              className="mt-2 text-sm font-medium text-brand-700 hover:underline"
            >
              + Agregar medicamento
            </button>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700">Guardado.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );

  if (!canEditNotes) {
    return vitalsAndNotes;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {vitalsAndNotes}

      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm">
        <div className="mb-4 border-b border-slate-200 pb-3 text-center">
          <p className="font-semibold text-slate-900">{clinicName}</p>
          <p className="text-xs text-slate-500">Receta médica</p>
        </div>

        <div className="mb-4 space-y-1 text-xs text-slate-600">
          <p>
            <span className="font-medium text-slate-700">Paciente:</span>{" "}
            {patientName}
          </p>
          <p>
            <span className="font-medium text-slate-700">Doctor:</span>{" "}
            {doctorName}
          </p>
          <p>
            <span className="font-medium text-slate-700">Fecha:</span> {date}
          </p>
        </div>

        <div className="space-y-2">
          {validMedications.length === 0 ? (
            <p className="text-slate-400">
              Sin medicamentos agregados todavía.
            </p>
          ) : (
            validMedications.map((m, i) => (
              <p key={i} className="text-slate-700">
                {i + 1}. <strong>{m.medicationName}</strong> —{" "}
                {formatDose(m)} cada {m.frequencyHours} hrs por{" "}
                {m.durationDays} {m.durationDays === "1" ? "día" : "días"}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
