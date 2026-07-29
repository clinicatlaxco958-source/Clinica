"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

export default function NewPatientModal({
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

  const [firstName, setFirstName] = useState("");
  const [lastNamePaternal, setLastNamePaternal] = useState("");
  const [lastNameMaternal, setLastNameMaternal] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [existingMatch, setExistingMatch] = useState<PatientResult | null>(
    null
  );
  const [duplicateCandidate, setDuplicateCandidate] =
    useState<PatientResult | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName("");
    setLastNamePaternal("");
    setLastNameMaternal("");
    setBirthDate("");
    setPhone("");
    setEmail("");
    setSearchResults([]);
    setShowPopover(false);
    setExistingMatch(null);
    setDuplicateCandidate(null);
    setError(null);
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

  // Búsqueda en vivo mientras se escribe nombre/apellido paterno, solo para
  // avisar de duplicados antes de terminar de llenar el formulario.
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

  function handleIdentityFieldChange(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      if (existingMatch) setExistingMatch(null);
    };
  }

  function selectExisting(p: PatientResult) {
    setFirstName(p.first_name);
    setLastNamePaternal(p.last_name_paternal);
    setLastNameMaternal(p.last_name_maternal ?? "");
    setBirthDate(p.birth_date);
    setPhone(p.phone ?? "");
    setEmail(p.email ?? "");
    setSearchResults([]);
    setShowPopover(false);
    setExistingMatch(p);
  }

  async function insertPatient() {
    setSubmitting(true);
    const { error: insertError } = await supabase.from("patients").insert({
      clinic_id: clinicId,
      first_name: firstName.trim(),
      last_name_paternal: lastNamePaternal.trim(),
      last_name_maternal: lastNameMaternal.trim() || null,
      birth_date: birthDate,
      phone: phone.trim() || null,
      email: email.trim() || null,
    });
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onCreated();
    onClose();
  }

  async function handleCreateClick() {
    setError(null);

    if (!firstName.trim() || !lastNamePaternal.trim() || !birthDate) {
      setError(
        "Nombre(s), apellido paterno y fecha de nacimiento son obligatorios."
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

    await insertPatient();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Nuevo paciente
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateClick();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <div ref={fieldRef} className="relative grid grid-cols-3 gap-2">
              <input
                placeholder="Nombre(s)"
                value={firstName}
                onChange={(e) =>
                  handleIdentityFieldChange(setFirstName)(e.target.value)
                }
                onFocus={() => setShowPopover(true)}
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
                onFocus={() => setShowPopover(true)}
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
                onFocus={() => setShowPopover(true)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              {showPopover && searchResults.length > 0 && (
                <div className="absolute left-full top-0 z-20 ml-3 w-72 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  <p className="border-b border-slate-100 px-3 py-2 text-xs font-medium uppercase text-slate-400">
                    Pacientes existentes
                  </p>
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectExisting(p)}
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

            {existingMatch && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Este paciente ya está registrado. No hace falta crearlo de
                nuevo.
              </div>
            )}

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
                    onClick={onClose}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Sí, ya existe (cerrar)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateCandidate(null);
                      insertPatient();
                    }}
                    className="rounded-lg border border-amber-400 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                  >
                    No, crear de todos modos
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

          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !!existingMatch}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Guardando..." : "Crear paciente"}
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
