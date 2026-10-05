import { notFound, redirect } from "next/navigation";
import { differenceInYears, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { specialtyArea, specialtyLabel } from "@/lib/specialties";
import ConsultaClient from "./ConsultaClient";
import type { AuthorInfo, HistoryData, IdentificationData } from "./MedicalHistorySection";

export default async function ConsultaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id, is_admin, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name, phone, address")
    .single();

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, date, start_time, end_time, doctor_id, patients(id, full_name, birth_date, phone, email, sex, curp, address, occupation, marital_status, blood_type, emergency_contact_name, emergency_contact_phone, ethnic_group, ethnic_group_detail), doctors(specialty, university, license_number, logo_url, watermark_url, users(full_name))"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!appointment) {
    notFound();
  }

  const { data: ownDoctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const isOwnAppointment =
    !!ownDoctor && appointment.doctor_id === ownDoctor.id;
  // A diferencia de isOwnAppointment (dueño de ESTA cita), la historia
  // clínica la puede ver/editar cualquier doctor de la clínica (o admin)
  // — mismo criterio que la política RLS de `medical_histories`. El
  // interrogatorio/antecedentes ("intake") también lo puede capturar
  // enfermería (para llenarlo en el lobby antes de la consulta); el
  // juicio clínico (exploración/diagnóstico/tratamiento) sigue siendo
  // exclusivo de doctor/admin sin importar el rol — blindado además con
  // un trigger en la base de datos (migración 018).
  const isDoctorOrAdmin = !!profile.is_admin || !!ownDoctor;
  const isNurse = profile.role === "nurse";
  const canEditIntake = isDoctorOrAdmin || isNurse;
  const canEditClinical = isDoctorOrAdmin;

  const doctor = appointment.doctors as any;
  // El bloque de historia clínica a exigir se decide por el ÁREA de la
  // especialidad del doctor de ESTA cita, no por `clinics.type` (ver
  // NEGOCIO.md sección 13 — "primera visita" es por especialidad).
  const area = specialtyArea(doctor?.specialty ?? null);

  const { data: consultationRow } = await supabase
    .from("consultations")
    .select(
      "weight_kg, height_cm, temperature_c, blood_pressure, heart_rate_bpm, respiratory_rate_rpm, notes, updated_at, updated_by, users:updated_by(full_name)"
    )
    .eq("appointment_id", appointment.id)
    .maybeSingle();

  const { data: medicalHistoryRow } = await supabase
    .from("medical_histories")
    .select(
      "heredo_familiares, personales_no_patologicos, personales_patologicos, tobacco_use, tobacco_detail, alcohol_use, alcohol_detail, other_substances_use, other_substances_detail, allergies, present_illness, systems_review, physical_exam, previous_studies, diagnosis, prognosis, treatment_plan, dental_history, oral_exam, odontogram, dental_diagnosis, dental_treatment_plan, intake_by, intake_at, intake_user:intake_by(full_name), clinical_by, clinical_at, clinical_user:clinical_by(full_name)"
    )
    .eq("patient_id", (appointment.patients as any)?.id)
    .maybeSingle();

  const { data: medications } = await supabase
    .from("prescription_items")
    .select(
      "id, medication_name, presentation, quantity, custom_instruction, frequency_hours, duration_days, pharmacy_item_id"
    )
    .eq("appointment_id", appointment.id)
    .order("created_at");

  const { data: pharmacyItemRows } = await supabase
    .from("pharmacy_items")
    .select("id, name")
    .eq("clinic_id", profile.clinic_id)
    .eq("active", true)
    .order("name");

  const { data: pharmacyMovementRows } = await supabase
    .from("pharmacy_movements")
    .select("item_id, movement_type, quantity_boxes")
    .eq("clinic_id", profile.clinic_id);

  const stockByItem = new Map<string, number>();
  for (const mv of pharmacyMovementRows ?? []) {
    const delta = mv.movement_type === "entrada" ? mv.quantity_boxes : -mv.quantity_boxes;
    stockByItem.set(mv.item_id, (stockByItem.get(mv.item_id) ?? 0) + delta);
  }
  const pharmacyItems = (pharmacyItemRows ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    currentStockBoxes: stockByItem.get(item.id) ?? 0,
  }));

  const patient = appointment.patients as any;
  const doctorName = doctor?.users?.full_name ?? null;
  const patientAge = patient?.birth_date
    ? differenceInYears(new Date(), parseISO(patient.birth_date))
    : null;

  const identification: IdentificationData = {
    sex: patient?.sex ?? "",
    curp: patient?.curp ?? "",
    address: patient?.address ?? "",
    occupation: patient?.occupation ?? "",
    maritalStatus: patient?.marital_status ?? "",
    bloodType: patient?.blood_type ?? "",
    emergencyContactName: patient?.emergency_contact_name ?? "",
    emergencyContactPhone: patient?.emergency_contact_phone ?? "",
    ethnicGroup: patient?.ethnic_group ?? "",
    ethnicGroupDetail: patient?.ethnic_group_detail ?? "",
  };

  const historyData: HistoryData | null = medicalHistoryRow
    ? {
        heredoFamiliares: medicalHistoryRow.heredo_familiares ?? "",
        personalesNoPatologicos: medicalHistoryRow.personales_no_patologicos ?? "",
        personalesPatologicos: medicalHistoryRow.personales_patologicos ?? "",
        tobaccoUse: medicalHistoryRow.tobacco_use ?? false,
        tobaccoDetail: medicalHistoryRow.tobacco_detail ?? "",
        alcoholUse: medicalHistoryRow.alcohol_use ?? false,
        alcoholDetail: medicalHistoryRow.alcohol_detail ?? "",
        otherSubstancesUse: medicalHistoryRow.other_substances_use ?? false,
        otherSubstancesDetail: medicalHistoryRow.other_substances_detail ?? "",
        allergies: medicalHistoryRow.allergies ?? "",
        presentIllness: medicalHistoryRow.present_illness ?? "",
        systemsReview: medicalHistoryRow.systems_review ?? "",
        physicalExam: medicalHistoryRow.physical_exam ?? "",
        previousStudies: medicalHistoryRow.previous_studies ?? "",
        diagnosis: medicalHistoryRow.diagnosis ?? "",
        prognosis: medicalHistoryRow.prognosis ?? "",
        treatmentPlan: medicalHistoryRow.treatment_plan ?? "",
        dentalHistory: medicalHistoryRow.dental_history ?? "",
        oralExam: medicalHistoryRow.oral_exam ?? "",
        odontogram: medicalHistoryRow.odontogram ?? "",
        dentalDiagnosis: medicalHistoryRow.dental_diagnosis ?? "",
        dentalTreatmentPlan: medicalHistoryRow.dental_treatment_plan ?? "",
      }
    : null;

  const intakeAuthor: AuthorInfo =
    medicalHistoryRow?.intake_by && medicalHistoryRow.intake_at
      ? {
          name: (medicalHistoryRow as any).intake_user?.full_name ?? "—",
          at: medicalHistoryRow.intake_at,
        }
      : null;
  const clinicalAuthor: AuthorInfo =
    medicalHistoryRow?.clinical_by && medicalHistoryRow.clinical_at
      ? {
          name: (medicalHistoryRow as any).clinical_user?.full_name ?? "—",
          at: medicalHistoryRow.clinical_at,
        }
      : null;

  return (
    <ConsultaClient
      isOwnAppointment={isOwnAppointment}
      patient={{
        id: patient?.id,
        fullName: patient?.full_name ?? "Paciente",
        birthDate: patient?.birth_date ?? "",
        phone: patient?.phone ?? null,
        email: patient?.email ?? null,
        age: patientAge,
      }}
      medicalHistory={{
        clinicId: profile.clinic_id,
        area,
        canEditIntake,
        canEditClinical,
        identification,
        history: historyData,
        intakeAuthor,
        clinicalAuthor,
      }}
      consultation={{
        appointmentId: appointment.id,
        appointmentDate: appointment.date,
        appointmentStartTime: appointment.start_time?.slice(0, 5) ?? "",
        appointmentEndTime: appointment.end_time?.slice(0, 5) ?? "",
        initialWeightKg: consultationRow?.weight_kg ?? null,
        initialHeightCm: consultationRow?.height_cm ?? null,
        initialTemperatureC: consultationRow?.temperature_c ?? null,
        initialBloodPressure: consultationRow?.blood_pressure ?? null,
        initialHeartRateBpm: consultationRow?.heart_rate_bpm ?? null,
        initialRespiratoryRateRpm: consultationRow?.respiratory_rate_rpm ?? null,
        initialNotes: consultationRow?.notes ?? null,
        initialMedications: (medications ?? []).map((m) => ({
          medicationName: m.medication_name,
          presentation: m.presentation as any,
          quantity: m.quantity != null ? String(m.quantity) : "",
          customInstruction: m.custom_instruction ?? "",
          frequencyHours: String(m.frequency_hours),
          durationDays: String(m.duration_days),
          pharmacyItemId: m.pharmacy_item_id ?? null,
        })),
        pharmacyItems,
        clinicName: clinic?.name ?? "Clínica",
        clinicAddress: clinic?.address ?? null,
        clinicPhone: clinic?.phone ?? null,
        doctorName: doctorName ?? "—",
        doctorSpecialty: doctor?.specialty ? specialtyLabel(doctor.specialty) : null,
        doctorUniversity: doctor?.university ?? null,
        doctorLicenseNumber: doctor?.license_number ?? null,
        doctorLogoUrl: doctor?.logo_url ?? null,
        doctorWatermarkUrl: doctor?.watermark_url ?? null,
        lastUpdatedByName: (consultationRow as any)?.users?.full_name ?? null,
        lastUpdatedAt: consultationRow?.updated_at ?? null,
      }}
    />
  );
}
