"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DoctorSettingsForm({
  doctorId,
  initialSpecialty,
  initialDuration,
  initialWorkStart,
  initialWorkEnd,
  clinicDefaultDuration,
  clinicDefaultWorkStart,
  clinicDefaultWorkEnd,
}: {
  doctorId: string;
  initialSpecialty: string | null;
  initialDuration: number | null;
  initialWorkStart: string | null;
  initialWorkEnd: string | null;
  clinicDefaultDuration: number;
  clinicDefaultWorkStart: string;
  clinicDefaultWorkEnd: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [specialty, setSpecialty] = useState(initialSpecialty ?? "");
  const [duration, setDuration] = useState(
    initialDuration != null ? String(initialDuration) : ""
  );
  const [workStart, setWorkStart] = useState(
    initialWorkStart?.slice(0, 5) ?? ""
  );
  const [workEnd, setWorkEnd] = useState(initialWorkEnd?.slice(0, 5) ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const durationValue = duration.trim() ? Number(duration) : null;
    if (
      durationValue !== null &&
      (!Number.isInteger(durationValue) || durationValue <= 0)
    ) {
      setError("La duración debe ser un número entero positivo.");
      return;
    }

    if (workStart && workEnd && workStart >= workEnd) {
      setError("La hora de inicio debe ser antes que la hora de fin.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("doctors")
      .update({
        specialty: specialty.trim() || null,
        default_duration_minutes: durationValue,
        work_start_time: workStart || null,
        work_end_time: workEnd || null,
      })
      .eq("id", doctorId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm"
    >
      <h2 className="text-sm font-semibold text-slate-900">
        Ajustes de doctor
      </h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Especialidad
        </label>
        <input
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Duración estándar de consulta (min)
        </label>
        <input
          type="number"
          min={1}
          placeholder={`Default de la clínica: ${clinicDefaultDuration}`}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">
          Se usa para calcular la hora de fin al agendar tus citas. Déjalo
          vacío para usar el default de la clínica (
          {clinicDefaultDuration} min).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Inicio de jornada
          </label>
          <input
            type="time"
            placeholder={clinicDefaultWorkStart}
            value={workStart}
            onChange={(e) => setWorkStart(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Fin de jornada
          </label>
          <input
            type="time"
            placeholder={clinicDefaultWorkEnd}
            value={workEnd}
            onChange={(e) => setWorkEnd(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Define los horarios válidos que se ofrecen al agendar tus citas.
        Déjalos vacíos para usar el default de la clínica (
        {clinicDefaultWorkStart}–{clinicDefaultWorkEnd}).
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="text-sm text-green-700">Guardado.</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
