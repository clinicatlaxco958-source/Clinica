"use client";

import { useMemo, useState } from "react";
import PatientHistoryModal, {
  type PatientSummary,
} from "@/components/PatientHistoryModal";

type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  birth_date: string;
};

function normalizeSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export default function PatientsTable({ patients }: { patients: Patient[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PatientSummary | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return patients;
    return patients.filter((p) => normalizeSearch(p.full_name).includes(q));
  }, [patients, query]);

  return (
    <>
      <input
        placeholder="Buscar paciente por nombre..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Nacimiento</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() =>
                        setSelected({
                          id: p.id,
                          fullName: p.full_name,
                          birthDate: p.birth_date,
                          phone: p.phone,
                          email: p.email,
                        })
                      }
                      className="text-brand-700 hover:underline"
                    >
                      {p.full_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {p.birth_date ?? "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  {query
                    ? "Sin resultados."
                    : "Aún no hay pacientes registrados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PatientHistoryModal
        patient={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
