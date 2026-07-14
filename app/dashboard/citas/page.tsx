import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AgendaCalendar from "./AgendaCalendar";

export default async function CitasPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id, role, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const canViewAllDoctors = profile.is_admin || profile.role !== "doctor";

  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "default_appointment_duration_minutes, default_work_start_time, default_work_end_time"
    )
    .single();

  const { data: doctors } = await supabase
    .from("doctors")
    .select(
      "id, specialty, default_duration_minutes, work_start_time, work_end_time, users(full_name)"
    )
    .order("full_name", { foreignTable: "users" });

  const { data: ownDoctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const allDoctors = (doctors ?? []).map((d) => ({
    id: d.id,
    fullName: (d.users as any)?.full_name ?? "Doctor",
    specialty: d.specialty,
    defaultDurationMinutes: d.default_duration_minutes,
    workStartTime: d.work_start_time ? d.work_start_time.slice(0, 5) : null,
    workEndTime: d.work_end_time ? d.work_end_time.slice(0, 5) : null,
  }));

  // Un doctor no-admin solo ve/agenda su propia agenda — ni siquiera se le
  // ofrece la opción de elegir a otro doctor (la RLS ya lo bloquearía de
  // todos modos, esto evita mostrarle una opción que no le serviría).
  const visibleDoctors = canViewAllDoctors
    ? allDoctors
    : allDoctors.filter((d) => d.id === ownDoctor?.id);

  return (
    <AgendaCalendar
      clinicId={profile.clinic_id}
      clinicDefaultDuration={clinic?.default_appointment_duration_minutes ?? 30}
      clinicDefaultWorkStart={(clinic?.default_work_start_time ?? "09:00:00").slice(0, 5)}
      clinicDefaultWorkEnd={(clinic?.default_work_end_time ?? "18:00:00").slice(0, 5)}
      doctors={visibleDoctors}
      defaultDoctorId={ownDoctor?.id ?? null}
      canViewAllDoctors={canViewAllDoctors}
    />
  );
}
