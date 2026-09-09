"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/errors";
import {
  PRESENTATIONS,
  emptyMedication,
  type MedicationRow,
} from "@/lib/prescription";
import PrescriptionSheet from "./PrescriptionSheet";
import PrintSettingsModal from "./PrintSettingsModal";

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
  clinicAddress,
  clinicPhone,
  patientName,
  patientAge,
  doctorName,
  doctorSpecialty,
  doctorUniversity,
  doctorLicenseNumber,
  doctorLogoUrl,
  doctorWatermarkUrl,
  pharmacyItems,
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
  clinicAddress: string | null;
  clinicPhone: string | null;
  patientName: string;
  patientAge: number | null;
  doctorName: string;
  doctorSpecialty: string | null;
  doctorUniversity: string | null;
  doctorLicenseNumber: string | null;
  doctorLogoUrl: string | null;
  doctorWatermarkUrl: string | null;
  pharmacyItems: {
    id: string;
    name: string;
    currentStockBoxes: number;
  }[];
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

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printCopy, setPrintCopy] = useState(false);
  const [halfPage, setHalfPage] = useState(false);
  const [printCopyFooter, setPrintCopyFooter] = useState(false);

  function updateMedication(
    index: number,
    field: keyof MedicationRow,
    value: string
  ) {
    setMedications((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  // Escribir el nombre a mano desliga el medicamento del catálogo de
  // farmacia (el vínculo solo se establece eligiendo del selector).
  function updateMedicationName(index: number, value: string) {
    setMedications((rows) =>
      rows.map((row, i) =>
        i === index
          ? { ...row, medicationName: value, pharmacyItemId: null }
          : row
      )
    );
  }

  function selectPharmacyItem(index: number, itemId: string) {
    setMedications((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        if (!itemId) return { ...row, pharmacyItemId: null };
        const item = pharmacyItems.find((p) => p.id === itemId);
        return {
          ...row,
          pharmacyItemId: itemId,
          medicationName: item ? item.name : row.medicationName,
        };
      })
    );
  }

  function addMedication() {
    setMedications((rows) => [...rows, emptyMedication()]);
  }

  function removeMedication(index: number) {
    setMedications((rows) => rows.filter((_, i) => i !== index));
  }

  const validMedications = medications.filter((m) => m.medicationName.trim());
  const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
  const vitals = [
    temperature ? `Temp: ${temperature}°C` : null,
    weight ? `Peso: ${weight}kg` : null,
    height ? `Talla: ${height}cm` : null,
    bloodPressure ? `T/A: ${bloodPressure}` : null,
  ].filter((v): v is string => v !== null);

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
      setError(
        friendlyErrorMessage(
          upsertError,
          "No se pudieron guardar los signos vitales."
        )
      );
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
        setError(
          friendlyErrorMessage(deleteError, "No se pudo guardar la receta.")
        );
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
              pharmacy_item_id: m.pharmacyItemId || null,
            }))
          );

        if (insertError) {
          setSaving(false);
          setError(
            friendlyErrorMessage(insertError, "No se pudo guardar la receta.")
          );
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
      className="print:hidden space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm"
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
                          updateMedicationName(i, e.target.value)
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

                    {pharmacyItems.length > 0 && (
                      <div className="mt-2">
                        <select
                          value={m.pharmacyItemId ?? ""}
                          onChange={(e) =>
                            selectPharmacyItem(i, e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500"
                        >
                          <option value="">De farmacia (opcional)</option>
                          {pharmacyItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} — {item.currentStockBoxes} caja
                              {item.currentStockBoxes === 1 ? "" : "s"} en
                              stock
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
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

  // Cuando hay copia + media hoja, las dos hojas deben sumar como máximo
  // una página física; se resta el alto de la línea divisoria (borde +
  // margen) de cada mitad para que no se pase a una segunda hoja.
  const sheetSizeClassName = halfPage
    ? "print:min-h-[calc(50vh-10px)]"
    : "print:min-h-screen";
  const sharedSheetProps = {
    doctorName,
    doctorSpecialty,
    doctorUniversity,
    doctorLicenseNumber,
    doctorLogoUrl,
    doctorWatermarkUrl,
    clinicName,
    clinicAddress,
    clinicPhone,
    patientName,
    patientAge,
    today,
    vitals,
    medications: validMedications,
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-8 print:block">
      <div className="lg:col-span-3">{vitalsAndNotes}</div>

      <div className="flex flex-col lg:col-span-5">
        <div className="print:hidden mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Receta</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-brand-700"
              aria-label="Ajustes de impresión"
              title="Ajustes de impresión"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-brand-700"
              aria-label="Imprimir receta"
              title="Imprimir receta"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M6 9V2h12v7" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hoja original: siempre visible en pantalla, y siempre se imprime */}
        <PrescriptionSheet
          {...sharedSheetProps}
          className={`flex flex-1 flex-col ${sheetSizeClassName}`}
          footerLabel={
            printCopy && printCopyFooter ? "Copia paciente" : undefined
          }
        />

        {/* Hoja copia: nunca se ve en pantalla, solo aparece al imprimir */}
        {printCopy && (
          <>
            {halfPage && (
              <div
                aria-hidden="true"
                className="hidden print:block my-1 border-t-2 border-dashed border-slate-400"
              />
            )}
            <PrescriptionSheet
              {...sharedSheetProps}
              className={`hidden print:flex print:flex-col ${sheetSizeClassName} ${
                halfPage ? "" : "break-before-page"
              }`}
              footerLabel={printCopyFooter ? "Copia doctor" : undefined}
            />
          </>
        )}
      </div>

      {settingsOpen && (
        <PrintSettingsModal
          printCopy={printCopy}
          onPrintCopyChange={setPrintCopy}
          halfPage={halfPage}
          onHalfPageChange={setHalfPage}
          printCopyFooter={printCopyFooter}
          onPrintCopyFooterChange={setPrintCopyFooter}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
