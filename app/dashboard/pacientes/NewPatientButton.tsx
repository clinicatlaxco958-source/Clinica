"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NewPatientModal from "./NewPatientModal";

export default function NewPatientButton({
  clinicId,
}: {
  clinicId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + Nuevo paciente
      </button>

      <NewPatientModal
        open={open}
        onClose={() => setOpen(false)}
        onCreated={() => router.refresh()}
        clinicId={clinicId}
      />
    </>
  );
}
