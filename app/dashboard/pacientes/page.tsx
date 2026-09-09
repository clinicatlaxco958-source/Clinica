import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PatientsTable from "./PatientsTable";
import NewPatientButton from "./NewPatientButton";

export default async function PacientesPage() {
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

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, phone, email, birth_date")
    .order("full_name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Pacientes</h1>
        <NewPatientButton clinicId={profile.clinic_id} />
      </div>

      <PatientsTable patients={patients ?? []} />
    </div>
  );
}
