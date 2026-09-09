type DbErrorLike = { message?: string; code?: string } | null | undefined;

// Códigos de error de Postgres que se pueden traducir a un mensaje genérico
// entendible sin exponer el texto técnico original.
const CODE_MESSAGES: Record<string, string> = {
  "42501": "No tienes permiso para hacer esto.",
  "23505": "Ya existe un registro con esos datos.",
  "23503": "No se puede completar porque hay información relacionada.",
  "23502": "Falta información obligatoria.",
  "23514": "Uno de los valores capturados no es válido.",
};

// Convierte un error de Supabase/Postgres en un mensaje seguro para mostrar
// a un usuario que no sabe de bases de datos. Nunca devuelve el texto
// técnico original si no lo reconocemos — mejor un mensaje genérico que uno
// que confunda o exponga detalles internos.
export function friendlyErrorMessage(
  error: DbErrorLike,
  fallback = "Ocurrió un error. Intenta de nuevo."
): string {
  if (!error) return fallback;
  if (error.code && CODE_MESSAGES[error.code]) {
    return CODE_MESSAGES[error.code];
  }
  if (error.message?.toLowerCase().includes("row-level security")) {
    return CODE_MESSAGES["42501"];
  }
  return fallback;
}
