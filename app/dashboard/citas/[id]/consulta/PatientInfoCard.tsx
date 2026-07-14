"use client";

import { useState } from "react";
import PatientHistoryModal, {
  type PatientSummary,
} from "@/components/PatientHistoryModal";

export default function PatientInfoCard({
  patient,
}: {
  patient: PatientSummary;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <p className="text-xs uppercase text-slate-400">Paciente</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-medium text-brand-700 hover:underline"
      >
        {patient.fullName}
      </button>
      <p className="text-xs text-slate-500">
        Nacimiento: {patient.birthDate}
        {patient.phone ? ` · Tel: ${patient.phone}` : ""}
        {patient.email ? ` · ${patient.email}` : ""}
      </p>

      {open && (
        <PatientHistoryModal patient={patient} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}
