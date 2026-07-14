import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ConsultationForm from "./ConsultationForm";
import PatientInfoCard from "./PatientInfoCard";

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
    .select("clinic_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: clinic } = await supabase
    .from("clinics")
    .select("name")
    .single();

  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, date, start_time, end_time, doctor_id, patients(id, full_name, birth_date, phone, email), doctors(users(full_name))"
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

  const { data: consultation } = await supabase
    .from("consultations")
    .select("weight_kg, height_cm, temperature_c, blood_pressure, notes")
    .eq("appointment_id", appointment.id)
    .maybeSingle();

  const { data: medications } = await supabase
    .from("prescription_items")
    .select(
      "id, medication_name, presentation, quantity, custom_instruction, frequency_hours, duration_days"
    )
    .eq("appointment_id", appointment.id)
    .order("created_at");

  const patient = appointment.patients as any;
  const doctorName = (appointment.doctors as any)?.users?.full_name ?? null;

  return (
    <div className={isOwnAppointment ? "max-w-5xl" : "max-w-lg"}>
      <Link
        href="/dashboard/citas"
        className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700"
      >
        ← Volver a la agenda
      </Link>

      <h1 className="mb-1 text-lg font-semibold text-slate-900">
        {isOwnAppointment ? "Consulta" : "Signos vitales"}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {appointment.date} · {appointment.start_time?.slice(0, 5)}–
        {appointment.end_time?.slice(0, 5)}
        {doctorName ? ` · ${doctorName}` : ""}
      </p>

      <PatientInfoCard
        patient={{
          id: patient?.id,
          fullName: patient?.full_name ?? "Paciente",
          birthDate: patient?.birth_date,
          phone: patient?.phone ?? null,
          email: patient?.email ?? null,
        }}
      />

      <ConsultationForm
        appointmentId={appointment.id}
        clinicId={profile.clinic_id}
        canEditNotes={isOwnAppointment}
        initialWeightKg={consultation?.weight_kg ?? null}
        initialHeightCm={consultation?.height_cm ?? null}
        initialTemperatureC={consultation?.temperature_c ?? null}
        initialBloodPressure={consultation?.blood_pressure ?? null}
        initialNotes={consultation?.notes ?? null}
        initialMedications={(medications ?? []).map((m) => ({
          medicationName: m.medication_name,
          presentation: m.presentation as any,
          quantity: m.quantity != null ? String(m.quantity) : "",
          customInstruction: m.custom_instruction ?? "",
          frequencyHours: String(m.frequency_hours),
          durationDays: String(m.duration_days),
        }))}
        clinicName={clinic?.name ?? "Clínica"}
        patientName={patient?.full_name ?? "Paciente"}
        doctorName={doctorName ?? "—"}
        date={appointment.date}
      />
    </div>
  );
}
