"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PatientSummary = {
  id: string;
  fullName: string;
  birthDate: string;
  phone: string | null;
  email: string | null;
};

type HistoryEntry = {
  appointmentId: string;
  date: string;
  startTime: string;
  status: string;
  doctorName: string | null;
  weightKg: number | null;
  heightCm: number | null;
  temperatureC: number | null;
  bloodPressure: string | null;
  notes: string | null;
};

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No asistió",
};

export default function PatientHistoryModal({
  patient,
  onClose,
}: {
  patient: PatientSummary | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patient) return;
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);

      const { data } = await supabase
        .from("appointments")
        .select(
          "id, date, start_time, status, doctors(users(full_name)), consultations(weight_kg, height_cm, temperature_c, blood_pressure, notes)"
        )
        .eq("patient_id", patient!.id)
        .order("date", { ascending: false })
        .order("start_time", { ascending: false });

      if (cancelled) return;

      const mapped: HistoryEntry[] = (data ?? []).map((a: any) => ({
        appointmentId: a.id,
        date: a.date,
        startTime: a.start_time?.slice(0, 5),
        status: a.status,
        doctorName: a.doctors?.users?.full_name ?? null,
        weightKg: a.consultations?.weight_kg ?? null,
        heightCm: a.consultations?.height_cm ?? null,
        temperatureC: a.consultations?.temperature_c ?? null,
        bloodPressure: a.consultations?.blood_pressure ?? null,
        notes: a.consultations?.notes ?? null,
      }));

      setHistory(mapped);
      setLoading(false);
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [patient?.id, supabase]);

  if (!patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-1 text-base font-semibold text-slate-900">
          {patient.fullName}
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Nacimiento: {patient.birthDate}
          {patient.phone ? ` · Tel: ${patient.phone}` : ""}
          {patient.email ? ` · ${patient.email}` : ""}
        </p>

        <h3 className="mb-2 text-sm font-semibold text-slate-900">
          Historial de consultas
        </h3>

        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-400">
            Sin consultas registradas todavía.
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((h) => (
              <div
                key={h.appointmentId}
                className="rounded-lg border border-slate-200 p-3 text-sm"
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium text-slate-700">
                    {h.date} {h.startTime}
                  </p>
                  <span className="text-xs text-slate-400">
                    {statusLabels[h.status] ?? h.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{h.doctorName ?? "—"}</p>
                {(h.weightKg ||
                  h.heightCm ||
                  h.temperatureC ||
                  h.bloodPressure) && (
                  <p className="mt-1 text-xs text-slate-500">
                    {[
                      h.weightKg ? `Peso: ${h.weightKg} kg` : null,
                      h.heightCm ? `Talla: ${h.heightCm} cm` : null,
                      h.temperatureC ? `Temp: ${h.temperatureC}°C` : null,
                      h.bloodPressure ? `PA: ${h.bloodPressure}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {h.notes && <p className="mt-1 text-slate-700">{h.notes}</p>}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
