import { createClient } from "@/lib/supabase/server";
import PatientsTable from "./PatientsTable";

export default async function PacientesPage() {
  const supabase = createClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, phone, email, birth_date")
    .order("full_name");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Pacientes</h1>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Nuevo paciente
        </button>
      </div>

      <PatientsTable patients={patients ?? []} />
    </div>
  );
}
