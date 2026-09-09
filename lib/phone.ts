// Formato de teléfono soportado: México, 10 dígitos. Sin validación de
// existencia real (OTP) todavía — ver PROGRESS.md, se agregará cuando
// haya presupuesto para SMS/WhatsApp.

export function normalizeMxPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  const hasCountryCode =
    trimmed.startsWith("+52") || (digits.startsWith("52") && digits.length === 12);
  const localDigits = hasCountryCode ? digits.slice(2) : digits;

  if (!/^\d{10}$/.test(localDigits)) return null;

  return `+52${localDigits}`;
}

export function formatMxPhoneForDisplay(e164: string): string {
  const local = e164.replace(/^\+52/, "");
  if (!/^\d{10}$/.test(local)) return e164;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
