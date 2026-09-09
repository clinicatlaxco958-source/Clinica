import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DoctorSettingsForm from "./DoctorSettingsForm";

const roleLabels: Record<string, string> = {
  doctor: "Doctor",
  receptionist: "Recepcionista",
};

export default async function PerfilPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, role, is_admin, clinics(name)")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select(
      "id, specialty, default_duration_minutes, work_start_time, work_end_time, university, license_number, logo_url, watermark_url"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: clinic } = await supabase
    .from("clinics")
    .select(
      "default_appointment_duration_minutes, default_work_start_time, default_work_end_time"
    )
    .single();

  const roleLabel = profile.role
    ? roleLabels[profile.role] ?? profile.role
    : "—";
  const clinicName = (profile.clinics as any)?.name ?? "—";

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Mi perfil</h1>

      {doctor ? (
        <DoctorSettingsForm
          doctorId={doctor.id}
          initialSpecialty={doctor.specialty}
          initialDuration={doctor.default_duration_minutes}
          initialWorkStart={doctor.work_start_time}
          initialWorkEnd={doctor.work_end_time}
          initialUniversity={doctor.university}
          initialLicenseNumber={doctor.license_number}
          initialLogoUrl={doctor.logo_url}
          initialWatermarkUrl={doctor.watermark_url}
          clinicDefaultDuration={
            clinic?.default_appointment_duration_minutes ?? 30
          }
          clinicDefaultWorkStart={(clinic?.default_work_start_time ?? "09:00:00").slice(0, 5)}
          clinicDefaultWorkEnd={(clinic?.default_work_end_time ?? "18:00:00").slice(0, 5)}
          fullName={profile.full_name}
          email={user.email ?? "—"}
          clinicName={clinicName}
          roleLabel={roleLabel}
          isAdmin={profile.is_admin ?? false}
        />
      ) : (
        <div className="max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm">
          <div>
            <p className="text-xs uppercase text-slate-400">Nombre</p>
            <p className="text-slate-700">{profile.full_name}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Correo</p>
            <p className="text-slate-700">{user.email}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Clínica</p>
            <p className="text-slate-700">{clinicName}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Función</p>
            <p className="text-slate-700">{roleLabel}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Permisos</p>
            <p className="text-slate-700">
              {profile.is_admin ? "Administrador" : "Staff"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
