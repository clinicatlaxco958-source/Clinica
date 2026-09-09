import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMxPhoneForDisplay } from "@/lib/phone";
import CreateUserForm from "./CreateUserForm";
import UserRowActions from "./UserRowActions";

const roleLabels: Record<string, string> = {
  doctor: "Doctor",
  receptionist: "Recepcionista",
};

export default async function UsuariosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin, active")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin || !profile.active) {
    redirect("/dashboard/citas");
  }

  const { data: staff } = await supabase
    .from("users")
    .select("id, full_name, role, is_admin, is_pharmacy, active, created_at")
    .order("created_at");

  // El correo vive en auth.users, no en public.users — se trae vía el
  // cliente admin (solo server-side), acotado a los ids ya filtrados por
  // RLS arriba (no expone usuarios de otras clínicas).
  const admin = createAdminClient();
  const contactEntries = await Promise.all(
    (staff ?? []).map(async (u) => {
      const { data } = await admin.auth.admin.getUserById(u.id);
      return [
        u.id,
        { email: data.user?.email ?? null, phone: data.user?.phone ?? null },
      ] as const;
    })
  );
  const contactByUserId = new Map(contactEntries);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Usuarios</h1>
      </div>

      <CreateUserForm />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Teléfono</th>
              <th className="px-4 py-3">Función</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Farmacia</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staff && staff.length > 0 ? (
              staff.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {u.full_name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {contactByUserId.get(u.id)?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {(() => {
                      const phone = contactByUserId.get(u.id)?.phone;
                      return phone ? formatMxPhoneForDisplay(phone) : "—";
                    })()}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.role ? roleLabels[u.role] ?? u.role : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.is_admin ? "Sí" : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.is_pharmacy ? "Sí" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        u.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.active ? "Activo" : "Suspendido"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <UserRowActions
                      userId={u.id}
                      active={u.active}
                      isSelf={u.id === user.id}
                    />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  No hay usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
