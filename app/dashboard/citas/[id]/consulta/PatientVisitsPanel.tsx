"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDose, type MedicationRow } from "@/lib/prescription";

// Panel de "consultas anteriores" específico de la pantalla de consulta
// (a diferencia de PatientHistoryModal.tsx, que sigue siendo un modal
// centrado y se usa tal cual en /dashboard/pacientes — decisión: este
// side panel no lo reemplaza ahí, solo aplica aquí). Dos side panels
// apilados desde la derecha, cada uno 1/3 de la pantalla: la lista, y
// (encima) el detalle de solo lectura de la visita seleccionada — qué
// padecimiento tuvo y qué tratamiento se le dio. Clic fuera de ambos
// los cierra los dos.

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  consultando: "Consultando",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No asistió",
};

type Visit = {
  appointmentId: string;
  date: string;
  startTime: string;
  status: string;
  doctorName: string | null;
  weightKg: number | null;
  heightCm: number | null;
  temperatureC: number | null;
  bloodPressure: string | null;
  heartRateBpm: number | null;
  respiratoryRateRpm: number | null;
  notes: string | null;
  medications: MedicationRow[];
};

// Duración de la transición (ms) — se usa tanto en la clase Tailwind
// (duration-300) como en el setTimeout que retrasa el desmontaje, deben
// coincidir o el panel "salta" al final en vez de deslizarse.
const TRANSITION_MS = 300;

// Un side panel no puede simplemente aparecer/desaparecer con la
// condición `open` — para que la SALIDA también se deslice (no solo la
// entrada), hay que seguir montado unos milisegundos más mientras la
// clase CSS ya cambió a la posición "afuera". `mounted` controla si el
// panel existe en el DOM; `visible` controla la clase de posición
// (adentro/afuera) que dispara la transición.
function useSlideState(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // Doble rAF: la primera espera al frame en el que React ya montó
      // el panel con la clase "afuera" (translate-x-full); la segunda
      // espera a que el navegador la haya PINTADO. Recién ahí se cambia
      // a "adentro" — un setTimeout corto no lo garantiza (a veces el
      // navegador pinta ya con el estado final y no hay nada que
      // animar, que es justo lo que pasaba: solo se veía la salida).
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(t);
  }, [open]);

  return { mounted, visible };
}

export default function PatientVisitsPanel({
  patientId,
  open,
  onClose,
}: {
  patientId: string;
  open: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // El detalle guarda el último id seleccionado para poder seguir
  // mostrando su contenido mientras se desliza hacia afuera (si
  // borráramos `selectedId` de una vez, el panel se vería vacío durante
  // la animación de salida).
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const list = useSlideState(open);
  const detail = useSlideState(selectedId !== null);

  useEffect(() => {
    if (selectedId) setLastSelectedId(selectedId);
  }, [selectedId]);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, date, start_time, status, doctors(users(full_name)), consultations(weight_kg, height_cm, temperature_c, blood_pressure, heart_rate_bpm, respiratory_rate_rpm, notes), prescription_items(medication_name, presentation, quantity, custom_instruction, frequency_hours, duration_days)"
        )
        .eq("patient_id", patientId)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });

      if (cancelled) return;

      const mapped: Visit[] = (data ?? []).map((a: any) => ({
        appointmentId: a.id,
        date: a.date,
        startTime: a.start_time?.slice(0, 5),
        status: a.status,
        doctorName: a.doctors?.users?.full_name ?? null,
        weightKg: a.consultations?.weight_kg ?? null,
        heightCm: a.consultations?.height_cm ?? null,
        temperatureC: a.consultations?.temperature_c ?? null,
        bloodPressure: a.consultations?.blood_pressure ?? null,
        heartRateBpm: a.consultations?.heart_rate_bpm ?? null,
        respiratoryRateRpm: a.consultations?.respiratory_rate_rpm ?? null,
        notes: a.consultations?.notes ?? null,
        medications: (a.prescription_items ?? []).map((m: any) => ({
          medicationName: m.medication_name,
          presentation: m.presentation,
          quantity: m.quantity != null ? String(m.quantity) : "",
          customInstruction: m.custom_instruction ?? "",
          frequencyHours: String(m.frequency_hours),
          durationDays: String(m.duration_days),
          pharmacyItemId: null,
        })),
      }));

      setVisits(mapped);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, patientId, supabase]);

  if (!list.mounted) return null;

  const selected = visits.find((v) => v.appointmentId === lastSelectedId) ?? null;

  function closeAll() {
    setSelectedId(null);
    onClose();
  }

  const vitalsLine = (v: Visit) =>
    [
      v.weightKg ? `Peso: ${v.weightKg}kg` : null,
      v.heightCm ? `Talla: ${v.heightCm}cm` : null,
      v.temperatureC ? `Temp: ${v.temperatureC}°C` : null,
      v.bloodPressure ? `T/A: ${v.bloodPressure}` : null,
      v.heartRateBpm ? `FC: ${v.heartRateBpm}lpm` : null,
      v.respiratoryRateRpm ? `FR: ${v.respiratoryRateRpm}rpm` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition-opacity duration-300 ${
          list.visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={closeAll}
        aria-hidden="true"
      />

      <div
        className={`fixed inset-y-0 right-0 z-40 w-1/3 min-w-[360px] overflow-y-auto bg-white p-6 text-sm shadow-xl transition-transform duration-300 ease-out ${
          list.visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Consultas anteriores
          </h2>
          <button
            type="button"
            onClick={closeAll}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            ×
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400">Cargando...</p>
        ) : visits.length === 0 ? (
          <p className="text-slate-400">Sin consultas registradas todavía.</p>
        ) : (
          <div className="space-y-3">
            {visits.map((v) => (
              <button
                key={v.appointmentId}
                type="button"
                onClick={() => setSelectedId(v.appointmentId)}
                className="block w-full rounded-lg border border-slate-200 p-3 text-left hover:border-brand-300 hover:bg-slate-50"
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium text-slate-700">
                    {v.date} {v.startTime}
                  </p>
                  <span className="text-xs text-slate-400">
                    {statusLabels[v.status] ?? v.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{v.doctorName ?? "—"}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {detail.mounted && selected && (
        <div
          className={`fixed inset-y-0 right-0 z-50 w-1/3 min-w-[360px] overflow-y-auto bg-white p-6 text-sm shadow-2xl transition-transform duration-300 ease-out ${
            detail.visible ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="mb-4 text-sm font-medium text-brand-700 hover:underline"
          >
            ← Regresar
          </button>

          <h2 className="mb-1 text-base font-semibold text-slate-900">
            {selected.date} · {selected.startTime}
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            {selected.doctorName ?? "—"} ·{" "}
            {statusLabels[selected.status] ?? selected.status}
          </p>

          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">
                Signos vitales
              </p>
              <p className="text-slate-700">
                {vitalsLine(selected) || "Sin registrar."}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">
                Padecimiento / notas de consulta
              </p>
              <p className="whitespace-pre-wrap text-slate-700">
                {selected.notes || "Sin notas registradas."}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">
                Tratamiento
              </p>
              {selected.medications.length === 0 ? (
                <p className="text-slate-700">Sin medicamentos recetados.</p>
              ) : (
                <ul className="list-disc space-y-1 pl-4 text-slate-700">
                  {selected.medications.map((m, i) => (
                    <li key={i}>
                      {m.medicationName} — {formatDose(m)}, cada{" "}
                      {m.frequencyHours}h por {m.durationDays} días
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
