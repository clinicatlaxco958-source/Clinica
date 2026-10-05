"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/errors";
import { specialtyLabel } from "@/lib/specialties";

type Doctor = {
  id: string;
  fullName: string;
  specialty: string | null;
  defaultDurationMinutes: number | null;
  workStartTime: string | null;
  workEndTime: string | null;
};

type PatientResult = {
  id: string;
  full_name: string;
  first_name: string;
  last_name_paternal: string;
  last_name_maternal: string | null;
  birth_date: string;
  phone: string | null;
  email: string | null;
};

const PATIENT_FIELDS =
  "id, full_name, first_name, last_name_paternal, last_name_maternal, birth_date, phone, email";

export type NewAppointmentDefaults = {
  date: string;
  startTime: string;
  doctorId: string | null;
};

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function endTimeFor(start: string, minutes: number) {
  const totalMinutes = toMinutes(start) + minutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function generateSlots(workStart: string, workEnd: string, duration: number) {
  const slots: string[] = [];
  let cursor = toMinutes(workStart);
  const end = toMinutes(workEnd);
  while (cursor + duration <= end) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    cursor += duration;
  }
  return slots;
}

// Normaliza para comparar sin importar acentos/mayúsculas ("José" = "Jose").
function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function formatDateDisplay(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function NewAppointmentModal({
  open,
  onClose,
  onCreated,
  clinicId,
  doctors,
  clinicDefaultDuration,
  clinicDefaultWorkStart,
  clinicDefaultWorkEnd,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  clinicId: string;
  doctors: Doctor[];
  clinicDefaultDuration: number;
  clinicDefaultWorkStart: string;
  clinicDefaultWorkEnd: string;
  defaults: NewAppointmentDefaults | null;
}) {
  const supabase = createClient();

  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState(clinicDefaultDuration);
  const [notes, setNotes] = useState("");

  const [timeSlots, setTimeSlots] = useState<
    { time: string; occupied: boolean }[]
  >([]);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [conflictConfirm, setConflictConfirm] = useState(false);
  const [pendingPatientId, setPendingPatientId] = useState<string | null>(
    null
  );

  // Paciente: un solo formulario, siempre visible. Escribir nombre/apellido
  // busca en vivo (popover); seleccionar uno existente solo rellena estos
  // mismos campos (no cambia el layout) para poder confirmar identidad.
  const [firstName, setFirstName] = useState("");
  const [lastNamePaternal, setLastNamePaternal] = useState("");
  const [lastNameMaternal, setLastNameMaternal] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    null
  );
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [showPatientPopover, setShowPatientPopover] = useState(false);
  const patientFieldRef = useRef<HTMLDivElement>(null);
  const [duplicateCandidate, setDuplicateCandidate] =
    useState<PatientResult | null>(null);
  const [confirmCreatePatient, setConfirmCreatePatient] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!showPatientPopover) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        patientFieldRef.current &&
        !patientFieldRef.current.contains(e.target as Node)
      ) {
        setShowPatientPopover(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPatientPopover]);

  useEffect(() => {
    if (!open) return;
    setDoctorId(defaults?.doctorId ?? "");
    setDate(defaults?.date ?? "");
    setStartTime(defaults?.startTime ?? "");
    setNotes("");
    setFirstName("");
    setLastNamePaternal("");
    setLastNameMaternal("");
    setBirthDate("");
    setPhone("");
    setEmail("");
    setSelectedPatientId(null);
    setSearchResults([]);
    setShowPatientPopover(false);
    setDuplicateCandidate(null);
    setConfirmCreatePatient(false);
    setConflictConfirm(false);
    setPendingPatientId(null);
    setError(null);
  }, [open, defaults]);

  useEffect(() => {
    const doc = doctors.find((d) => d.id === doctorId);
    setDuration(doc?.defaultDurationMinutes ?? clinicDefaultDuration);
  }, [doctorId, doctors, clinicDefaultDuration]);

  useEffect(() => {
    if (!doctorId || !date) {
      setTimeSlots([]);
      return;
    }
    let cancelled = false;

    async function loadAvailability() {
      setLoadingTimes(true);

      const doc = doctors.find((d) => d.id === doctorId);
      const workStart = doc?.workStartTime ?? clinicDefaultWorkStart;
      const workEnd = doc?.workEndTime ?? clinicDefaultWorkEnd;
      const dur = doc?.defaultDurationMinutes ?? clinicDefaultDuration;

      const { data: existing } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("doctor_id", doctorId)
        .eq("date", date)
        .neq("status", "cancelada");

      if (cancelled) return;

      const occupied = (existing ?? []).map((a: any) => ({
        start: toMinutes(a.start_time.slice(0, 5)),
        end: toMinutes(a.end_time.slice(0, 5)),
      }));

      const slots = generateSlots(workStart, workEnd, dur).map((slot) => {
        const slotStart = toMinutes(slot);
        const slotEnd = slotStart + dur;
        return {
          time: slot,
          occupied: occupied.some((o) => slotStart < o.end && slotEnd > o.start),
        };
      });

      setTimeSlots(slots);
      setLoadingTimes(false);
    }

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [
    doctorId,
    date,
    doctors,
    clinicDefaultDuration,
    clinicDefaultWorkStart,
    clinicDefaultWorkEnd,
    supabase,
  ]);

  // Búsqueda en vivo mientras se escribe nombre/apellido paterno. Sigue
  // corriendo aunque ya haya un paciente seleccionado, para poder cambiarlo
  // solo con volver a enfocar el campo (ver onFocus más abajo).
  useEffect(() => {
    const term = `${firstName} ${lastNamePaternal}`.trim();
    if (!term) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from("patients")
        .select(PATIENT_FIELDS)
        .ilike("full_name_search", `%${normalizeSearch(term)}%`)
        .order("full_name")
        .limit(8);
      if (!cancelled) setSearchResults(data ?? []);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [firstName, lastNamePaternal, supabase]);

  function fillFromPatient(p: PatientResult) {
    setFirstName(p.first_name);
    setLastNamePaternal(p.last_name_paternal);
    setLastNameMaternal(p.last_name_maternal ?? "");
    setBirthDate(p.birth_date);
    setPhone(p.phone ?? "");
    setEmail(p.email ?? "");
    setSelectedPatientId(p.id);
  }

  function selectPatient(p: PatientResult) {
    fillFromPatient(p);
    setSearchResults([]);
    setShowPatientPopover(false);
    setDuplicateCandidate(null);
    setConfirmCreatePatient(false);
  }

  function clearSelectedPatient() {
    setSelectedPatientId(null);
    setFirstName("");
    setLastNamePaternal("");
    setLastNameMaternal("");
    setBirthDate("");
    setPhone("");
    setEmail("");
  }

  // Editar nombre/apellido/nacimiento después de haber seleccionado un
  // paciente existente lo desvincula (vuelve a modo búsqueda/nuevo).
  function handleIdentityFieldChange(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      if (selectedPatientId) setSelectedPatientId(null);
    };
  }

  async function createAppointment(patientId: string, force: boolean) {
    if (!duration || duration <= 0) {
      setError("La duración debe ser mayor a 0.");
      return;
    }

    const endTime = endTimeFor(startTime, duration);
    setSubmitting(true);

    if (!force) {
      const { data: conflicts } = await supabase
        .from("appointments")
        .select("id")
        .eq("doctor_id", doctorId)
        .eq("date", date)
        .neq("status", "cancelada")
        .lt("start_time", endTime)
        .gt("end_time", startTime);

      if (conflicts && conflicts.length > 0) {
        setPendingPatientId(patientId);
        setConflictConfirm(true);
        setSubmitting(false);
        return;
      }
    }

    const { error: insertError } = await supabase.from("appointments").insert({
      clinic_id: clinicId,
      patient_id: patientId,
      doctor_id: doctorId,
      date,
      start_time: startTime,
      end_time: endTime,
      notes: notes.trim() || null,
    });

    setSubmitting(false);

    if (insertError) {
      setError(
        friendlyErrorMessage(
          insertError,
          "No se pudo guardar la cita. Intenta de nuevo."
        )
      );
      return;
    }

    onCreated();
    onClose();
  }

  async function createNewPatientAndAppointment() {
    setSubmitting(true);
    const { data: created, error: patientError } = await supabase
      .from("patients")
      .insert({
        clinic_id: clinicId,
        first_name: firstName.trim(),
        last_name_paternal: lastNamePaternal.trim(),
        last_name_maternal: lastNameMaternal.trim() || null,
        birth_date: birthDate,
        phone: phone.trim() || null,
        email: email.trim() || null,
      })
      .select(PATIENT_FIELDS)
      .single();

    if (patientError || !created) {
      setSubmitting(false);
      setError(
        friendlyErrorMessage(patientError, "No se pudo crear el paciente.")
      );
      return;
    }

    setSubmitting(false);
    setSelectedPatientId(created.id);
    await createAppointment(created.id, false);
  }

  async function handleCreateClick() {
    setError(null);

    if (!doctorId) {
      setError("Selecciona un doctor.");
      return;
    }
    if (!date || !startTime) {
      setError("Selecciona fecha y hora.");
      return;
    }

    if (selectedPatientId) {
      await createAppointment(selectedPatientId, false);
      return;
    }

    if (!firstName.trim() || !lastNamePaternal.trim() || !birthDate) {
      setError(
        "Nombre(s), apellido paterno y fecha de nacimiento del paciente son obligatorios."
      );
      return;
    }

    setSubmitting(true);
    const { data: existing } = await supabase
      .from("patients")
      .select(PATIENT_FIELDS)
      .eq("first_name_search", normalizeSearch(firstName))
      .eq("last_name_paternal_search", normalizeSearch(lastNamePaternal))
      .eq("birth_date", birthDate)
      .limit(1);
    setSubmitting(false);

    if (existing && existing.length > 0) {
      setDuplicateCandidate(existing[0]);
      return;
    }

    setConfirmCreatePatient(true);
  }

  function confirmUseDuplicate() {
    if (!duplicateCandidate) return;
    const patient = duplicateCandidate;
    setDuplicateCandidate(null);
    fillFromPatient(patient);
    createAppointment(patient.id, false);
  }

  async function confirmCreateAsNewFromDuplicate() {
    setDuplicateCandidate(null);
    await createNewPatientAndAppointment();
  }

  async function confirmCreateNewPatient() {
    setConfirmCreatePatient(false);
    await createNewPatientAndAppointment();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Nueva cita
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateClick();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Paciente
              </label>
              {selectedPatientId && (
                <button
                  type="button"
                  onClick={clearSelectedPatient}
                  className="text-xs font-medium text-slate-400 hover:text-slate-600"
                >
                  Quitar selección
                </button>
              )}
            </div>

            <div
              ref={patientFieldRef}
              className="relative grid grid-cols-3 gap-2"
            >
              <input
                placeholder="Nombre(s)"
                value={firstName}
                onChange={(e) =>
                  handleIdentityFieldChange(setFirstName)(e.target.value)
                }
                onFocus={() => setShowPatientPopover(true)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Apellido paterno"
                value={lastNamePaternal}
                onChange={(e) =>
                  handleIdentityFieldChange(setLastNamePaternal)(
                    e.target.value
                  )
                }
                onFocus={() => setShowPatientPopover(true)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Apellido materno"
                value={lastNameMaternal}
                onChange={(e) =>
                  handleIdentityFieldChange(setLastNameMaternal)(
                    e.target.value
                  )
                }
                onFocus={() => setShowPatientPopover(true)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              {showPatientPopover && searchResults.length > 0 && (
                <div className="absolute left-full top-0 z-20 ml-3 w-72 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium uppercase text-slate-400">
                    Pacientes existentes
                  </p>
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPatient(p)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="font-medium">{p.full_name}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {formatDateDisplay(p.birth_date)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Fecha de nacimiento
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={(e) =>
                  handleIdentityFieldChange(setBirthDate)(e.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Teléfono (opcional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Correo (opcional)"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            {duplicateCandidate && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="text-amber-800">
                  Ya existe un paciente con este nombre y fecha de nacimiento:{" "}
                  <strong>{duplicateCandidate.full_name}</strong>. ¿Es la
                  misma persona?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={confirmUseDuplicate}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Usar este paciente
                  </button>
                  <button
                    type="button"
                    onClick={confirmCreateAsNewFromDuplicate}
                    className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Crear de todos modos
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateCandidate(null)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {confirmCreatePatient && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
                <p className="text-blue-800">
                  Este paciente no existe todavía. ¿Deseas crearlo?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={confirmCreateNewPatient}
                    disabled={submitting}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {submitting ? "Creando..." : "Sí, crear paciente"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmCreatePatient(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Revisar datos
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Doctor
            </label>
            <select
              value={doctorId}
              onChange={(e) => {
                setDoctorId(e.target.value);
                setStartTime("");
                setConflictConfirm(false);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Selecciona un doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.fullName}
                  {d.specialty ? ` (${specialtyLabel(d.specialty)})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Fecha
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setStartTime("");
                  setConflictConfirm(false);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Hora
              </label>
              <select
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setConflictConfirm(false);
                }}
                disabled={!doctorId || !date || loadingTimes}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {!doctorId || !date
                    ? "Elige doctor y fecha"
                    : loadingTimes
                    ? "Cargando..."
                    : timeSlots.length === 0
                    ? "Sin horarios en la jornada"
                    : "Selecciona una hora"}
                </option>
                {timeSlots.map((slot) => (
                  <option key={slot.time} value={slot.time}>
                    {slot.time}
                    {slot.occupied ? " (ocupado)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {startTime && (
            <p className="text-xs text-slate-500">
              Duración: {duration} min (termina aprox. a las{" "}
              {endTimeFor(startTime, duration)}) — definida en el perfil del
              doctor.
            </p>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {conflictConfirm && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="text-amber-800">
                Este horario ya tiene una cita agendada para este doctor.
                ¿Agendar de todos modos?
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    pendingPatientId &&
                    createAppointment(pendingPatientId, true)
                  }
                  disabled={submitting}
                  className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                >
                  {submitting ? "Guardando..." : "Agendar de todos modos"}
                </button>
                <button
                  type="button"
                  onClick={() => setConflictConfirm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Elegir otro horario
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : "Crear cita"}
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
