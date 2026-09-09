import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardNav from "@/components/DashboardNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("full_name, is_admin, is_pharmacy, clinics(name)")
    .eq("id", user.id)
    .single();

  // Sin perfil vinculado o suspendido (RLS ya no resuelve su clinic_id):
  // no puede usar el dashboard.
  if (!profile) {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader
        fullName={profile.full_name ?? "Usuario"}
        clinicName={(profile.clinics as any)?.name ?? "Clínica"}
      />
      <div className="flex flex-1">
        <DashboardNav
          isAdmin={profile.is_admin ?? false}
          canAccessPharmacy={
            (profile.is_admin || profile.is_pharmacy) ?? false
          }
        />
        <main className="print:p-0 flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
