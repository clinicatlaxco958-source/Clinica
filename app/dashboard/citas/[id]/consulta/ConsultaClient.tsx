"use client";

import { useState } from "react";
import Link from "next/link";
import PatientInfoCard from "./PatientInfoCard";
import PatientVisitsPanel from "./PatientVisitsPanel";
import MedicalHistorySection, {
  type AuthorInfo,
  type HistoryData,
  type IdentificationData,
  type ModalMode,
} from "./MedicalHistorySection";
import ConsultationForm from "./ConsultationForm";
import type { SpecialtyArea } from "@/lib/specialties";
import type { MedicationRow } from "@/lib/prescription";

// Coordina PatientInfoCard (los botones/accesos), MedicalHistorySection
// (los modales de historia clínica) y ConsultationForm ("Terminar
// consulta" no debe poder cerrar la cita mientras falte historia
// clínica obligatoria) — ver NEGOCIO.md sección 13. Los tres son
// independientes entre sí; se agrupan aquí para compartir el estado de
// qué modal está abierto y en qué modo, y si la historia ya está
// completa.
export default function ConsultaClient({
  isOwnAppointment,
  patient,
  medicalHistory,
  consultation,
}: {
  isOwnAppointment: boolean;
  patient: {
    id: string;
    fullName: string;
    birthDate: string;
    phone: string | null;
    email: string | null;
    age: number | null;
  };
  medicalHistory: {
    clinicId: string;
    area: SpecialtyArea | null;
    canEditIntake: boolean;
    canEditClinical: boolean;
    identification: IdentificationData;
    history: HistoryData | null;
    intakeAuthor: AuthorInfo;
    clinicalAuthor: AuthorInfo;
  };
  consultation: {
    appointmentId: string;
    appointmentDate: string;
    appointmentStartTime: string;
    appointmentEndTime: string;
    initialWeightKg: number | null;
    initialHeightCm: number | null;
    initialTemperatureC: number | null;
    initialBloodPressure: string | null;
    initialHeartRateBpm: number | null;
    initialRespiratoryRateRpm: number | null;
    initialNotes: string | null;
    initialMedications: MedicationRow[];
    pharmacyItems: { id: string; name: string; currentStockBoxes: number }[];
    clinicName: string;
    clinicAddress: string | null;
    clinicPhone: string | null;
    doctorName: string;
    doctorSpecialty: string | null;
    doctorUniversity: string | null;
    doctorLicenseNumber: string | null;
    doctorLogoUrl: string | null;
    doctorWatermarkUrl: string | null;
    lastUpdatedByName: string | null;
    lastUpdatedAt: string | null;
  };
}) {
  const [intakeComplete, setIntakeComplete] = useState(true);
  const [clinicalComplete, setClinicalComplete] = useState(true);
  const [pendingIdCount, setPendingIdCount] = useState(0);

  const [intakeMode, setIntakeMode] = useState<ModalMode>("closed");
  const [clinicalMode, setClinicalMode] = useState<ModalMode>("closed");
  const [identificationOpen, setIdentificationOpen] = useState(false);
  const [visitsOpen, setVisitsOpen] = useState(false);

  // "Terminar consulta" se bloqueó por historia clínica incompleta —
  // reabre en modo edición justo el bloque (o los bloques) que falten,
  // en vez del truco de "forceOpenSignal" que usaba antes: ahora el
  // modo del modal vive aquí mismo, así que no hace falta un contador,
  // solo se setea directo.
  function handleIncompleteHistory() {
    if (!intakeComplete) setIntakeMode("edit");
    if (!clinicalComplete) setClinicalMode("edit");
  }

  return (
    <div className={isOwnAppointment ? undefined : "max-w-lg"}>
      <Link
        href="/dashboard/citas"
        className="print:hidden mb-4 inline-block text-sm text-slate-500 hover:text-slate-700"
      >
        ← Volver a la agenda
      </Link>

      <div className="print:hidden">
        <PatientInfoCard
          patient={{
            id: patient.id,
            fullName: patient.fullName,
            birthDate: patient.birthDate,
            phone: patient.phone,
            email: patient.email,
          }}
          canEditIntake={medicalHistory.canEditIntake}
          canEditClinical={medicalHistory.canEditClinical}
          intakeComplete={intakeComplete}
          clinicalComplete={clinicalComplete}
          pendingIdCount={pendingIdCount}
          onOpenIntake={setIntakeMode}
          onOpenClinical={setClinicalMode}
          onOpenIdentification={() => setIdentificationOpen(true)}
          onOpenVisits={() => setVisitsOpen(true)}
        />
      </div>

      <MedicalHistorySection
        patientId={patient.id}
        clinicId={medicalHistory.clinicId}
        area={medicalHistory.area}
        canEditIntake={medicalHistory.canEditIntake}
        canEditClinical={medicalHistory.canEditClinical}
        initialIdentification={medicalHistory.identification}
        initialHistory={medicalHistory.history}
        initialIntakeAuthor={medicalHistory.intakeAuthor}
        initialClinicalAuthor={medicalHistory.clinicalAuthor}
        intakeMode={intakeMode}
        onIntakeModeChange={setIntakeMode}
        clinicalMode={clinicalMode}
        onClinicalModeChange={setClinicalMode}
        identificationOpen={identificationOpen}
        onIdentificationOpenChange={setIdentificationOpen}
        onCompletenessChange={(intake, clinical) => {
          setIntakeComplete(intake);
          setClinicalComplete(clinical);
        }}
        onPendingIdentificationChange={setPendingIdCount}
      />

      <PatientVisitsPanel
        patientId={patient.id}
        open={visitsOpen}
        onClose={() => setVisitsOpen(false)}
      />

      <ConsultationForm
        appointmentId={consultation.appointmentId}
        clinicId={medicalHistory.clinicId}
        canEditNotes={isOwnAppointment}
        appointmentDate={consultation.appointmentDate}
        appointmentStartTime={consultation.appointmentStartTime}
        appointmentEndTime={consultation.appointmentEndTime}
        initialWeightKg={consultation.initialWeightKg}
        initialHeightCm={consultation.initialHeightCm}
        initialTemperatureC={consultation.initialTemperatureC}
        initialBloodPressure={consultation.initialBloodPressure}
        initialHeartRateBpm={consultation.initialHeartRateBpm}
        initialRespiratoryRateRpm={consultation.initialRespiratoryRateRpm}
        initialNotes={consultation.initialNotes}
        initialMedications={consultation.initialMedications}
        pharmacyItems={consultation.pharmacyItems}
        clinicName={consultation.clinicName}
        clinicAddress={consultation.clinicAddress}
        clinicPhone={consultation.clinicPhone}
        patientName={patient.fullName}
        patientAge={patient.age}
        doctorName={consultation.doctorName}
        doctorSpecialty={consultation.doctorSpecialty}
        doctorUniversity={consultation.doctorUniversity}
        doctorLicenseNumber={consultation.doctorLicenseNumber}
        doctorLogoUrl={consultation.doctorLogoUrl}
        doctorWatermarkUrl={consultation.doctorWatermarkUrl}
        lastUpdatedByName={consultation.lastUpdatedByName}
        lastUpdatedAt={consultation.lastUpdatedAt}
        historyComplete={intakeComplete && clinicalComplete}
        onIncompleteHistory={handleIncompleteHistory}
      />
    </div>
  );
}
