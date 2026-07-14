"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUS_ORDER = [
  "pendiente",
  "confirmada",
  "completada",
  "cancelada",
  "no_show",
] as const;

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No asistió",
};

const statusColors: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  confirmada: "bg-blue-100 text-blue-700",
  completada: "bg-green-100 text-green-700",
  cancelada: "bg-slate-100 text-slate-500",
  no_show: "bg-red-100 text-red-700",
};

type Doctor = {
  id: string;
  fullName: string;
};

export type AppointmentDetail = {
  id: string;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  doctorId: string | null;
  doctorName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  paymentStatus: string;
  notes: string | null;
  hasVitals: boolean;
};

export default function AppointmentDetailModal({
  appointment,
  onClose,
  onUpdated,
  doctors,
  canReassignDoctor,
  currentUserDoctorId,
}: {
  appointment: AppointmentDetail | null;
  onClose: () => void;
  onUpdated: () => void;
  doctors: Doctor[];
  canReassignDoctor: boolean;
  currentUserDoctorId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const [reassigning, setReassigning] = useState(false);
  const [newDoctorId, setNewDoctorId] = useState("");

  useEffect(() => {
    if (!showStatusMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStatusMenu]);

  useEffect(() => {
    setShowStatusMenu(false);
    setReassigning(false);
    setNewDoctorId("");
    setError(null);
  }, [appointment?.id]);

  if (!appointment) return null;

  async function updateStatus(newStatus: string) {
    if (!appointment) return;
    setError(null);
    setUpdating(true);

    const { error: updateError } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", appointment.id);

    setUpdating(false);
    setShowStatusMenu(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onUpdated();
    onClose();
  }

  async function handleReassign() {
    if (!appointment || !newDoctorId) return;
    setError(null);
    setUpdating(true);

    const { error: updateError } = await supabase
      .from("appointments")
      .update({ doctor_id: newDoctorId })
      .eq("id", appointment.id);

    setUpdating(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onUpdated();
    onClose();
  }

  const isOwnAppointment =
    currentUserDoctorId != null && appointment.doctorId === currentUserDoctorId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            Detalle de cita
          </h2>

          <div ref={statusRef} className="relative">
            <button
              type="button"
              onClick={() => setShowStatusMenu((v) => !v)}
              disabled={updating}
              className={`rounded-full px-2 py-1 text-xs font-medium hover:opacity-80 disabled:opacity-60 ${
                statusColors[appointment.status] ??
                "bg-slate-100 text-slate-500"
              }`}
            >
              {updating
                ? "Guardando..."
                : statusLabels[appointment.status] ?? appointment.status}
            </button>

            {showStatusMenu && (
              <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {STATUS_ORDER.filter((s) => s !== appointment.status).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => updateStatus(s)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          statusColors[s].split(" ")[0]
                        }`}
                      />
                      {statusLabels[s]}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase text-slate-400">Paciente</p>
            <p className="text-slate-700">{appointment.patientName}</p>
            {(appointment.patientPhone || appointment.patientEmail) && (
              <p className="text-xs text-slate-500">
                {[appointment.patientPhone, appointment.patientEmail]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-slate-400">Doctor</p>
              {canReassignDoctor && !reassigning && (
                <button
                  type="button"
                  onClick={() => {
                    setReassigning(true);
                    setNewDoctorId(appointment.doctorId ?? "");
                  }}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Reasignar
                </button>
              )}
            </div>
            {reassigning ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  value={newDoctorId}
                  onChange={(e) => setNewDoctorId(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Selecciona un doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.fullName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleReassign}
                  disabled={updating || !newDoctorId}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {updating ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setReassigning(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <p className="text-slate-700">{appointment.doctorName ?? "—"}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase text-slate-400">Fecha</p>
              <p className="text-slate-700">{appointment.date}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Hora</p>
              <p className="text-slate-700">
                {appointment.startTime}–{appointment.endTime}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-400">Pago</p>
            <p className="text-slate-700">
              {appointment.paymentStatus === "pagado" ? "Pagado" : "Pendiente"}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-400">
              Motivo / notas
            </p>
            <p className="text-slate-700">{appointment.notes || "—"}</p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => router.push(`/dashboard/citas/${appointment.id}/consulta`)}
          className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {isOwnAppointment
            ? "Iniciar consulta"
            : appointment.hasVitals
            ? "Modificar signos vitales"
            : "Capturar signos vitales"}
        </button>

        <button
          onClick={onClose}
          className="mt-2 w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
