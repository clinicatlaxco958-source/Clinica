export type PresentationValue =
  | "tableta"
  | "capsula"
  | "jarabe"
  | "gotas"
  | "inyeccion"
  | "crema"
  | "otro";

export const PRESENTATIONS: {
  value: PresentationValue;
  label: string;
  verb: string;
  unitSingular: string;
  unitPlural: string;
  needsQuantity: boolean;
}[] = [
  {
    value: "tableta",
    label: "Tableta",
    verb: "Tomar",
    unitSingular: "tableta",
    unitPlural: "tabletas",
    needsQuantity: true,
  },
  {
    value: "capsula",
    label: "Cápsula",
    verb: "Tomar",
    unitSingular: "cápsula",
    unitPlural: "cápsulas",
    needsQuantity: true,
  },
  {
    value: "jarabe",
    label: "Jarabe/Suspensión (mL)",
    verb: "Tomar",
    unitSingular: "mL",
    unitPlural: "mL",
    needsQuantity: true,
  },
  {
    value: "gotas",
    label: "Gotas",
    verb: "Aplicar",
    unitSingular: "gota",
    unitPlural: "gotas",
    needsQuantity: true,
  },
  {
    value: "inyeccion",
    label: "Inyección/Ampolleta",
    verb: "Aplicar",
    unitSingular: "ampolleta",
    unitPlural: "ampolletas",
    needsQuantity: true,
  },
  {
    value: "crema",
    label: "Crema/Ungüento",
    verb: "Aplicar",
    unitSingular: "",
    unitPlural: "",
    needsQuantity: false,
  },
  {
    value: "otro",
    label: "Otro (instrucción libre)",
    verb: "",
    unitSingular: "",
    unitPlural: "",
    needsQuantity: false,
  },
];

export type MedicationRow = {
  medicationName: string;
  presentation: PresentationValue;
  quantity: string;
  customInstruction: string;
  frequencyHours: string;
  durationDays: string;
  // Vínculo opcional al catálogo de farmacia (pharmacy_items.id). Solo
  // trazabilidad/sugerencia de stock — medicationName sigue siendo texto
  // libre y no depende de este campo.
  pharmacyItemId: string | null;
};

export function formatDose(m: MedicationRow) {
  const preset =
    PRESENTATIONS.find((p) => p.value === m.presentation) ?? PRESENTATIONS[0];

  if (m.presentation === "otro") {
    return m.customInstruction.trim();
  }
  if (!preset.needsQuantity) {
    return preset.verb;
  }
  const qty = m.quantity || "1";
  const unit = Number(qty) === 1 ? preset.unitSingular : preset.unitPlural;
  return `${preset.verb} ${qty} ${unit}`;
}

export function emptyMedication(): MedicationRow {
  return {
    medicationName: "",
    presentation: "tableta",
    quantity: "",
    customInstruction: "",
    frequencyHours: "",
    durationDays: "",
    pharmacyItemId: null,
  };
}
