// Catálogo de especialidades — global y fijo (compartido por todas las
// clínicas, no personalizable por clínica). Cada especialidad declara su
// "área", que decide qué bloque de historia clínica aplica en
// MedicalHistorySection.tsx (ver NEGOCIO.md sección 13). Agregar una
// especialidad nueva es una migración chica (ampliar el check constraint
// de `doctors.specialty` en Supabase) + agregarla aquí, igual que se
// agregan nuevas presentaciones de medicamento en lib/prescription.ts.
export type SpecialtyArea = "medica" | "dental";

export const SPECIALTIES: {
  value: string;
  label: string;
  area: SpecialtyArea;
}[] = [
  { value: "medico_general", label: "Médico general", area: "medica" },
  { value: "dentista", label: "Dentista", area: "dental" },
];

export function specialtyArea(value: string | null | undefined): SpecialtyArea | null {
  return SPECIALTIES.find((s) => s.value === value)?.area ?? null;
}

export function specialtyLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return SPECIALTIES.find((s) => s.value === value)?.label ?? value;
}
