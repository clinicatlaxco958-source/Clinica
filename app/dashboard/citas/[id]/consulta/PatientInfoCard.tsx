"use client";

import type { PatientSummary } from "@/components/PatientHistoryModal";
import type { ModalMode } from "./MedicalHistorySection";

// Banner del paciente en la pantalla de consulta — hub de accesos:
// historia clínica (antecedentes / exploración y diagnóstico), ficha de
// identificación pendiente, y consultas anteriores. Los modales/panel
// que abren estos botones viven en MedicalHistorySection.tsx y
// PatientVisitsPanel.tsx; este componente solo dispara los callbacks
// que ConsultaClient.tsx coordina.
export default function PatientInfoCard({
  patient,
  canEditIntake,
  canEditClinical,
  intakeComplete,
  clinicalComplete,
  pendingIdCount,
  onOpenIntake,
  onOpenClinical,
  onOpenIdentification,
  onOpenVisits,
}: {
  patient: PatientSummary;
  canEditIntake: boolean;
  canEditClinical: boolean;
  intakeComplete: boolean;
  clinicalComplete: boolean;
  pendingIdCount: number;
  onOpenIntake: (mode: ModalMode) => void;
  onOpenClinical: (mode: ModalMode) => void;
  onOpenIdentification: () => void;
  onOpenVisits: () => void;
}) {
  const canViewClinical = canEditIntake || canEditClinical;

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <p className="text-xs uppercase text-slate-400">Paciente</p>
      <p className="font-medium text-slate-900">{patient.fullName}</p>
      <p className="text-xs text-slate-500">
        Nacimiento: {patient.birthDate}
        {patient.phone ? ` · Tel: ${patient.phone}` : ""}
        {patient.email ? ` · ${patient.email}` : ""}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onOpenVisits}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Consultas anteriores
        </button>

        {canEditIntake && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Antecedentes:</span>
            {intakeComplete ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenIntake("view")}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => onOpenIntake("edit")}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Editar
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => onOpenIntake("edit")}
                className="font-medium text-amber-700 hover:underline"
              >
                Completar
              </button>
            )}
          </div>
        )}

        {canViewClinical && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Exploración y diagnóstico:</span>
            {clinicalComplete ? (
              <>
                <button
                  type="button"
                  onClick={() => onOpenClinical("view")}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Ver
                </button>
                {canEditClinical && (
                  <button
                    type="button"
                    onClick={() => onOpenClinical("edit")}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    Editar
                  </button>
                )}
              </>
            ) : canEditClinical ? (
              <button
                type="button"
                onClick={() => onOpenClinical("edit")}
                className="font-medium text-amber-700 hover:underline"
              >
                Completar
              </button>
            ) : (
              <span className="text-xs text-slate-400">
                Pendiente (lo captura el doctor)
              </span>
            )}
          </div>
        )}

        {!canViewClinical && (
          <p className="text-xs text-slate-400">
            Historia clínica: acceso exclusivo de doctor/enfermería.
          </p>
        )}

        <button
          type="button"
          onClick={onOpenIdentification}
          className={
            pendingIdCount > 0
              ? "rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
              : "text-sm text-slate-500 hover:underline"
          }
        >
          {pendingIdCount > 0
            ? `⚠ Datos pendientes (${pendingIdCount})`
            : "Ficha de identificación"}
        </button>
      </div>
    </div>
  );
}
