"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeMxPhone } from "@/lib/phone";
import { friendlyErrorMessage } from "@/lib/errors";

type ActionResult =
  | { error: string }
  | { success: true }
  | { tempPassword: string; email?: string; phone?: string };

function generateTempPassword() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado.");

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id, is_admin, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_admin || !profile.active) {
    throw new Error("No tienes permisos de administrador.");
  }

  return { clinicId: profile.clinic_id as string };
}

export async function createStaffUser(
  formData: FormData
): Promise<ActionResult> {
  const { clinicId } = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = (String(formData.get("role") ?? "") || null) as
    | "doctor"
    | "receptionist"
    | null;
  const specialty = String(formData.get("specialty") ?? "").trim() || null;
  const durationRaw = String(formData.get("duration_minutes") ?? "").trim();
  const durationMinutes = durationRaw ? Number(durationRaw) : null;
  const isAdmin = formData.get("is_admin") === "on";
  const isPharmacy = formData.get("is_pharmacy") === "on";

  if (!fullName) {
    return { error: "El nombre es obligatorio." };
  }

  if (!email && !phoneRaw) {
    return { error: "Captura correo o teléfono (al menos uno)." };
  }

  let phone: string | null = null;
  if (phoneRaw) {
    phone = normalizeMxPhone(phoneRaw);
    if (!phone) {
      return { error: "El teléfono debe tener 10 dígitos (México)." };
    }
  }

  if (durationRaw && (!Number.isInteger(durationMinutes) || (durationMinutes as number) <= 0)) {
    return { error: "La duración de consulta debe ser un número entero positivo." };
  }

  const admin = createAdminClient();
  const tempPassword = generateTempPassword();

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: email || undefined,
      phone: phone || undefined,
      password: tempPassword,
      email_confirm: !!email,
      // Sin envío de OTP todavía (sin proveedor de SMS/WhatsApp
      // configurado) — se confía el número tal cual, solo validado en
      // formato. Cuando haya presupuesto para un proveedor, este flag
      // pasa a depender de la verificación real.
      phone_confirm: !!phone,
      user_metadata: { must_change_password: true },
    });

  if (createError || !created.user) {
    const message = createError?.message ?? "";
    return {
      error: message.toLowerCase().includes("already")
        ? "Ya existe un usuario con ese correo o teléfono."
        : "No se pudo crear el usuario. Intenta de nuevo.",
    };
  }

  const { error: insertError } = await admin.from("users").insert({
    id: created.user.id,
    clinic_id: clinicId,
    full_name: fullName,
    role,
    is_admin: isAdmin,
    is_pharmacy: isPharmacy,
  });

  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return {
      error: friendlyErrorMessage(
        insertError,
        "No se pudo crear el usuario. Intenta de nuevo."
      ),
    };
  }

  if (role === "doctor") {
    await admin.from("doctors").insert({
      user_id: created.user.id,
      clinic_id: clinicId,
      specialty,
      default_duration_minutes: durationMinutes,
    });
  }

  revalidatePath("/dashboard/usuarios");
  return { tempPassword, email: email || undefined, phone: phone || undefined };
}

export async function setUserActive(
  userId: string,
  active: boolean
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = createClient();

  const { error } = await supabase
    .from("users")
    .update({ active })
    .eq("id", userId);

  if (error) {
    return {
      error: friendlyErrorMessage(
        error,
        "No se pudo actualizar el usuario. Intenta de nuevo."
      ),
    };
  }

  revalidatePath("/dashboard/usuarios");
  return { success: true };
}

export async function deleteStaffUser(userId: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { error: "No se pudo eliminar el usuario. Intenta de nuevo." };
  }

  revalidatePath("/dashboard/usuarios");
  return { success: true };
}

export async function resetStaffPassword(
  userId: string
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();

  const tempPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { must_change_password: true },
  });

  if (error) {
    return {
      error: "No se pudo restablecer la contraseña. Intenta de nuevo.",
    };
  }

  return { tempPassword };
}
