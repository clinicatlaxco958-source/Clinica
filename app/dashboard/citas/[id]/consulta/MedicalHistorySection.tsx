"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorMessage } from "@/lib/errors";
import type { SpecialtyArea } from "@/lib/specialties";

// Campos de texto libre renderizados por FieldGroup (excluye los checks
// de tabaquismo/alcohol/otras sustancias, que son booleanos y se
// renderizan aparte, ver ToxicHabitCheck más abajo).
type TextFieldKey = Exclude<
  keyof HistoryData,
  "tobaccoUse" | "alcoholUse" | "otherSubstancesUse"
>;
type Field = { key: TextFieldKey; column: string; label: string; placeholder?: string };

// "closed" = modal oculto; "view" = campos deshabilitados (solo
// lectura); "edit" = campos editables + botón de guardar. El botón
// "Editar" dentro del modal en modo "view" cambia a "edit" sin cerrar
// la ventana (ver ConsultaClient.tsx, que es quien decide en qué modo
// abrir cada modal según el botón que el usuario haya usado en
// PatientInfoCard.tsx).
export type ModalMode = "closed" | "view" | "edit";

export type IdentificationData = {
  sex: string;
  curp: string;
  address: string;
  occupation: string;
  maritalStatus: string;
  bloodType: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  // Opcional ("en su caso", NOM-004 numeral 6.1.1) — nunca cuenta para
  // el aviso de "datos pendientes", ver IDENTIFICATION_OPTIONAL_FIELDS.
  ethnicGroup: string;
  ethnicGroupDetail: string;
};

export type HistoryData = {
  heredoFamiliares: string;
  personalesNoPatologicos: string;
  personalesPatologicos: string;
  // Tabaquismo/alcoholismo/otras sustancias psicoactivas — checks
  // estructurados dentro de "personales patológicos" (NOM-004 numeral
  // 6.1.1 los ubica ahí, no en "no patológicos").
  tobaccoUse: boolean;
  tobaccoDetail: string;
  alcoholUse: boolean;
  alcoholDetail: string;
  otherSubstancesUse: boolean;
  otherSubstancesDetail: string;
  allergies: string;
  presentIllness: string;
  systemsReview: string;
  physicalExam: string;
  previousStudies: string;
  diagnosis: string;
  prognosis: string;
  treatmentPlan: string;
  dentalHistory: string;
  oralExam: string;
  odontogram: string;
  dentalDiagnosis: string;
  dentalTreatmentPlan: string;
};

const EMPTY_HISTORY: HistoryData = {
  heredoFamiliares: "",
  personalesNoPatologicos: "",
  personalesPatologicos: "",
  tobaccoUse: false,
  tobaccoDetail: "",
  alcoholUse: false,
  alcoholDetail: "",
  otherSubstancesUse: false,
  otherSubstancesDetail: "",
  allergies: "",
  presentIllness: "",
  systemsReview: "",
  physicalExam: "",
  previousStudies: "",
  diagnosis: "",
  prognosis: "",
  treatmentPlan: "",
  dentalHistory: "",
  oralExam: "",
  odontogram: "",
  dentalDiagnosis: "",
  dentalTreatmentPlan: "",
};

// "Intake": interrogatorio/antecedentes tal como los narra el paciente —
// lo puede capturar enfermería (o el doctor) en el lobby antes de la
// consulta, ver NEGOCIO.md sección 13.
const CORE_INTAKE_FIELDS: Field[] = [
  {
    key: "heredoFamiliares",
    column: "heredo_familiares",
    label: "Antecedentes heredo-familiares",
    placeholder:
      'Enfermedades en padres/hermanos (diabetes, hipertensión, cáncer...). Si no hay, anótalo ("Niega antecedentes de importancia").',
  },
  {
    key: "personalesNoPatologicos",
    column: "personales_no_patologicos",
    label: "Antecedentes personales no patológicos",
    placeholder: "Higiene, alimentación, actividad física, vivienda.",
  },
  {
    key: "personalesPatologicos",
    column: "personales_patologicos",
    label: "Antecedentes personales patológicos (otros)",
    placeholder:
      "Aparte de tabaquismo/alcohol/otras sustancias (se preguntan abajo): enfermedades previas, cirugías, traumatismos, transfusiones, y ginecoobstétricos si aplica.",
  },
  {
    key: "allergies",
    column: "allergies",
    label: "Alergias",
    placeholder:
      'Medicamentos, alimentos, otras. Si no tiene, anótalo ("Niega alergias conocidas").',
  },
];

const MEDICAL_INTAKE_FIELDS: Field[] = [
  {
    key: "presentIllness",
    column: "present_illness",
    label: "Padecimiento actual",
    placeholder: "Motivo de la consulta y evolución del síntoma.",
  },
  {
    key: "systemsReview",
    column: "systems_review",
    label: "Interrogatorio por aparatos y sistemas",
  },
  {
    key: "previousStudies",
    column: "previous_studies",
    label: "Resultados de estudios previos",
    placeholder: 'Laboratorio/imagen previos. Si no hay, anótalo ("Sin estudios previos").',
  },
];

// "Clínico": juicio médico — exclusivo de doctor/admin sin importar el
// rol de quien esté en la pantalla (blindado también con un trigger en
// la base de datos, ver migración 018).
const MEDICAL_CLINICAL_FIELDS: Field[] = [
  {
    key: "physicalExam",
    column: "physical_exam",
    label: "Exploración física",
    placeholder:
      "Habitus exterior; cabeza y cuello; tórax; abdomen; miembros; genitales (si aplica). Anota hallazgos relevantes por región (si no hay nada que reportar en alguna, anótalo: \"sin alteraciones\").",
  },
  { key: "diagnosis", column: "diagnosis", label: "Diagnóstico" },
  { key: "prognosis", column: "prognosis", label: "Pronóstico" },
  { key: "treatmentPlan", column: "treatment_plan", label: "Plan de tratamiento" },
];

const DENTAL_INTAKE_FIELDS: Field[] = [
  { key: "dentalHistory", column: "dental_history", label: "Antecedentes odontológicos" },
];

const DENTAL_CLINICAL_FIELDS: Field[] = [
  { key: "oralExam", column: "oral_exam", label: "Exploración bucal" },
  { key: "dentalDiagnosis", column: "dental_diagnosis", label: "Diagnóstico dental" },
  {
    key: "dentalTreatmentPlan",
    column: "dental_treatment_plan",
    label: "Plan de tratamiento dental",
  },
];

// Odontograma queda como campo opcional en esta primera versión (texto
// libre) — un mapa visual interactivo de 32 piezas es un componente
// aparte, ver NEGOCIO.md sección 13.
const DENTAL_CLINICAL_OPTIONAL_FIELDS: Field[] = [
  {
    key: "odontogram",
    column: "odontogram",
    label: "Odontograma (opcional, texto libre por ahora)",
    placeholder: 'Ej. "Pieza 16 con caries oclusal, resto sin hallazgos."',
  },
];

// El bloque clínico se exige por el ÁREA de la especialidad del doctor
// de ESTA cita (no por `clinics.type`) — así una cita con el médico
// general no exige antes tener listo el bloque dental, y viceversa; ver
// NEGOCIO.md sección 13 ("primera visita" es por especialidad).
function fieldsForArea(area: SpecialtyArea | null) {
  return {
    intakeRequired: [
      ...CORE_INTAKE_FIELDS,
      ...(area === "medica" ? MEDICAL_INTAKE_FIELDS : []),
      ...(area === "dental" ? DENTAL_INTAKE_FIELDS : []),
    ],
    clinicalRequired: [
      ...(area === "medica" ? MEDICAL_CLINICAL_FIELDS : []),
      ...(area === "dental" ? DENTAL_CLINICAL_FIELDS : []),
    ],
    clinicalOptional: area === "dental" ? DENTAL_CLINICAL_OPTIONAL_FIELDS : [],
  };
}

const IDENTIFICATION_FIELDS: {
  key: keyof IdentificationData;
  column: string;
  label: string;
}[] = [
  { key: "curp", column: "curp", label: "CURP" },
  { key: "sex", column: "sex", label: "Sexo" },
  { key: "maritalStatus", column: "marital_status", label: "Estado civil" },
  { key: "occupation", column: "occupation", label: "Ocupación" },
  { key: "bloodType", column: "blood_type", label: "Tipo de sangre" },
  { key: "address", column: "address", label: "Domicilio" },
  {
    key: "emergencyContactName",
    column: "emergency_contact_name",
    label: "Contacto de emergencia (nombre)",
  },
  {
    key: "emergencyContactPhone",
    column: "emergency_contact_phone",
    label: "Contacto de emergencia (teléfono)",
  },
];

// Lista práctica de los grupos más numerosos, no el catálogo oficial
// completo del INPI (68 pueblos reconocidos) — "otro" cubre el resto.
const ETHNIC_GROUPS: { value: string; label: string }[] = [
  { value: "ninguno", label: "Ninguno / no aplica" },
  { value: "nahuatl", label: "Náhuatl" },
  { value: "maya", label: "Maya" },
  { value: "zapoteco", label: "Zapoteco" },
  { value: "mixteco", label: "Mixteco" },
  { value: "otomi", label: "Otomí" },
  { value: "totonaca", label: "Totonaca" },
  { value: "tzeltal", label: "Tzeltal" },
  { value: "tzotzil", label: "Tzotzil" },
  { value: "mazahua", label: "Mazahua" },
  { value: "mazateco", label: "Mazateco" },
  { value: "huasteco", label: "Huasteco" },
  { value: "chol", label: "Chol" },
  { value: "purepecha", label: "Purépecha" },
  { value: "mixe", label: "Mixe" },
  { value: "chinanteco", label: "Chinanteco" },
  { value: "afromexicano", label: "Afromexicano(a)" },
  { value: "otro", label: "Otro (especifique)" },
];

function textInput(
  field: { key: keyof IdentificationData; label: string },
  value: string,
  onChange: (v: string) => void
) {
  if (field.key === "sex") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Sin especificar</option>
        <option value="femenino">Femenino</option>
        <option value="masculino">Masculino</option>
      </select>
    );
  }
  if (field.key === "maritalStatus") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Sin especificar</option>
        <option value="soltero">Soltero(a)</option>
        <option value="casado">Casado(a)</option>
        <option value="union_libre">Unión libre</option>
        <option value="divorciado">Divorciado(a)</option>
        <option value="viudo">Viudo(a)</option>
      </select>
    );
  }
  if (field.key === "bloodType") {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Sin especificar</option>
        {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bt) => (
          <option key={bt} value={bt}>
            {bt}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
    />
  );
}

// Sección de textareas reutilizada por el bloque de intake y el clínico
// — misma UI, distinta lista de campos/permiso/botón de guardado.
// `disabled` deja los campos visibles pero no editables (modo "Ver" o
// enfermería viendo el bloque clínico que no le toca) — siempre son el
// mismo textarea, nunca cambia a texto plano, para que se sienta como
// "el mismo formulario, solo que no puedes tocarlo ahora".
function FieldGroup({
  title,
  fields,
  optionalFields = [],
  history,
  onChange,
  disabled,
}: {
  title: string;
  fields: Field[];
  optionalFields?: Field[];
  history: HistoryData;
  onChange: (key: TextFieldKey, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase text-slate-400">{title}</p>
      {[...fields, ...optionalFields].map((f) => (
        <div key={f.key}>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            {f.label}
            {optionalFields.includes(f) ? "" : " *"}
          </label>
          <textarea
            value={history[f.key]}
            onChange={(e) => onChange(f.key, e.target.value)}
            placeholder={f.placeholder}
            rows={2}
            disabled={disabled}
            className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${
              disabled ? "bg-slate-50 text-slate-500" : ""
            }`}
          />
        </div>
      ))}
    </div>
  );
}

// Un check de tabaquismo/alcohol/otras sustancias: siempre tiene
// respuesta válida (marcado o no), por eso no participa en la
// validación de "campo obligatorio" como los textareas de FieldGroup.
function ToxicHabitCheck({
  label,
  detailPlaceholder,
  checked,
  detail,
  disabled,
  onCheckedChange,
  onDetailChange,
}: {
  label: string;
  detailPlaceholder: string;
  checked: boolean;
  detail: string;
  disabled: boolean;
  onCheckedChange: (v: boolean) => void;
  onDetailChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        {label}
      </label>
      {checked && (
        <input
          value={detail}
          disabled={disabled}
          onChange={(e) => onDetailChange(e.target.value)}
          placeholder={detailPlaceholder}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}

export type AuthorInfo = { name: string; at: string } | null;

function AuthorLine({ author }: { author: AuthorInfo }) {
  if (!author) return null;
  const formatted = new Date(author.at).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <p className="text-xs text-slate-400">
      Última edición: {formatted} por {author.name}
    </p>
  );
}

// Cascarón de modal compartido por los tres modales de esta sección
// (antecedentes, exploración/diagnóstico, ficha de identificación) —
// mismo backdrop + panel, mismo botón de cerrar.
function ModalShell({
  title,
  onClose,
  hint,
  children,
}: {
  title: string;
  onClose: () => void;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-2 flex items-start justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            ×
          </button>
        </div>
        {hint && <p className="mb-4 text-xs text-slate-500">{hint}</p>}
        <div className="space-y-4 text-sm">{children}</div>
      </div>
    </div>
  );
}

export default function MedicalHistorySection({
  patientId,
  clinicId,
  area,
  canEditIntake,
  canEditClinical,
  initialIdentification,
  initialHistory,
  initialIntakeAuthor,
  initialClinicalAuthor,
  intakeMode,
  onIntakeModeChange,
  clinicalMode,
  onClinicalModeChange,
  identificationOpen,
  onIdentificationOpenChange,
  onCompletenessChange,
  onPendingIdentificationChange,
}: {
  patientId: string;
  clinicId: string;
  area: SpecialtyArea | null;
  canEditIntake: boolean;
  canEditClinical: boolean;
  initialIdentification: IdentificationData;
  initialHistory: HistoryData | null;
  initialIntakeAuthor: AuthorInfo;
  initialClinicalAuthor: AuthorInfo;
  intakeMode: ModalMode;
  onIntakeModeChange: (mode: ModalMode) => void;
  clinicalMode: ModalMode;
  onClinicalModeChange: (mode: ModalMode) => void;
  identificationOpen: boolean;
  onIdentificationOpenChange: (open: boolean) => void;
  onCompletenessChange?: (intakeComplete: boolean, clinicalComplete: boolean) => void;
  onPendingIdentificationChange?: (count: number) => void;
}) {
  const router = useRouter();
  const supabase = createClient();

  const { intakeRequired, clinicalRequired, clinicalOptional } = useMemo(
    () => fieldsForArea(area),
    [area]
  );

  const [identification, setIdentification] = useState<IdentificationData>(
    initialIdentification
  );
  const [history, setHistory] = useState<HistoryData>(
    initialHistory ?? EMPTY_HISTORY
  );
  const [intakeAuthor, setIntakeAuthor] = useState<AuthorInfo>(
    initialIntakeAuthor
  );
  const [clinicalAuthor, setClinicalAuthor] = useState<AuthorInfo>(
    initialClinicalAuthor
  );

  // Ojo: esto refleja lo GUARDADO, no lo que se está escribiendo en este
  // momento — solo se actualiza dentro de saveIntake/saveClinical al
  // guardar con éxito. Si dependiera de `history` en vivo, el modal
  // cambiaría de modo solo a media escritura en cuanto el último campo
  // obligatorio dejara de estar vacío, aunque nadie le haya dado
  // "Guardar" todavía (y "Terminar consulta" podría dejar pasar
  // antecedentes que nunca se llegaron a guardar).
  const [intakeComplete, setIntakeComplete] = useState(() =>
    intakeRequired.every((f) => history[f.key].trim())
  );
  const [clinicalComplete, setClinicalComplete] = useState(() =>
    clinicalRequired.every((f) => history[f.key].trim())
  );

  useEffect(() => {
    onCompletenessChange?.(intakeComplete, clinicalComplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeComplete, clinicalComplete]);

  const [savingIntake, setSavingIntake] = useState(false);
  const [savingClinical, setSavingClinical] = useState(false);
  const [savingIdentification, setSavingIdentification] = useState(false);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [clinicalError, setClinicalError] = useState<string | null>(null);
  const [identificationError, setIdentificationError] = useState<string | null>(
    null
  );
  const [intakeSaved, setIntakeSaved] = useState(false);
  const [clinicalSaved, setClinicalSaved] = useState(false);
  const [identificationSaved, setIdentificationSaved] = useState(false);

  const pendingFields = IDENTIFICATION_FIELDS.filter(
    (f) => !identification[f.key].trim()
  );

  useEffect(() => {
    onPendingIdentificationChange?.(pendingFields.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFields.length]);

  // Al entrar a la pantalla de consulta, si falta algo importante se
  // abre solo (no hay que ir a buscar el botón en el banner) — tanto si
  // falta la ficha de identificación del paciente como si falta
  // historia clínica. Cada bloque se abre solo si a quien ve la
  // pantalla le toca resolverlo (mismo criterio que el resto de la
  // sección: a enfermería no se le abre el bloque clínico, que no
  // puede editar). Corre una sola vez al montar — si siguen
  // incompletos la próxima visita, vuelve a abrirse, a propósito.
  useEffect(() => {
    if (canEditIntake && !intakeComplete) onIntakeModeChange("edit");
    if (canEditClinical && !clinicalComplete) onClinicalModeChange("edit");
    if (pendingFields.length > 0) onIdentificationOpenChange(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateHistoryField<K extends keyof HistoryData>(key: K, value: HistoryData[K]) {
    setHistory((prev) => ({ ...prev, [key]: value }));
  }
  const updateHistory = (key: TextFieldKey, value: string) =>
    updateHistoryField(key, value);

  async function saveIdentification() {
    setIdentificationError(null);
    setIdentificationSaved(false);
    setSavingIdentification(true);

    const curp = identification.curp.trim().toUpperCase();
    if (curp && !/^[A-Z0-9]{18}$/.test(curp)) {
      setSavingIdentification(false);
      setIdentificationError("La CURP debe tener 18 caracteres (letras y números).");
      return;
    }

    const payload: Record<string, unknown> = { curp: curp || null };
    for (const f of IDENTIFICATION_FIELDS) {
      if (f.key === "curp") continue;
      payload[f.column] = identification[f.key].trim() || null;
    }
    payload.ethnic_group = identification.ethnicGroup || null;
    payload.ethnic_group_detail = identification.ethnicGroupDetail.trim() || null;

    const { error } = await supabase
      .from("patients")
      .update(payload)
      .eq("id", patientId);

    setSavingIdentification(false);
    if (error) {
      setIdentificationError(
        friendlyErrorMessage(error, "No se pudieron guardar los datos.")
      );
      return;
    }
    setIdentificationSaved(true);
    router.refresh();
  }

  async function saveIntake() {
    setIntakeError(null);
    setIntakeSaved(false);

    const missing = intakeRequired.filter((f) => !history[f.key].trim());
    if (missing.length > 0) {
      setIntakeError(
        `Faltan datos obligatorios: ${missing.map((f) => f.label).join(", ")}.`
      );
      return;
    }

    setSavingIntake(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = {
      patient_id: patientId,
      clinic_id: clinicId,
      intake_by: user?.id ?? null,
      intake_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    for (const f of intakeRequired) {
      payload[f.column] = history[f.key].trim() || null;
    }
    payload.tobacco_use = history.tobaccoUse;
    payload.tobacco_detail = history.tobaccoDetail.trim() || null;
    payload.alcohol_use = history.alcoholUse;
    payload.alcohol_detail = history.alcoholDetail.trim() || null;
    payload.other_substances_use = history.otherSubstancesUse;
    payload.other_substances_detail = history.otherSubstancesDetail.trim() || null;

    const { error } = await supabase
      .from("medical_histories")
      .upsert(payload, { onConflict: "patient_id" });

    setSavingIntake(false);
    if (error) {
      setIntakeError(
        friendlyErrorMessage(error, "No se pudo guardar el interrogatorio.")
      );
      return;
    }
    setIntakeSaved(true);
    setIntakeComplete(true);
    setIntakeAuthor({ name: "Tú", at: payload.intake_at as string });
    onIntakeModeChange("view");
    router.refresh();
  }

  async function saveClinical() {
    setClinicalError(null);
    setClinicalSaved(false);

    const missing = clinicalRequired.filter((f) => !history[f.key].trim());
    if (missing.length > 0) {
      setClinicalError(
        `Faltan datos obligatorios: ${missing.map((f) => f.label).join(", ")}.`
      );
      return;
    }

    setSavingClinical(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const payload: Record<string, unknown> = {
      patient_id: patientId,
      clinic_id: clinicId,
      clinical_by: user?.id ?? null,
      clinical_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    for (const f of [...clinicalRequired, ...clinicalOptional]) {
      payload[f.column] = history[f.key].trim() || null;
    }

    const { error } = await supabase
      .from("medical_histories")
      .upsert(payload, { onConflict: "patient_id" });

    setSavingClinical(false);
    if (error) {
      setClinicalError(
        friendlyErrorMessage(
          error,
          "No se pudo guardar la exploración/diagnóstico."
        )
      );
      return;
    }
    setClinicalSaved(true);
    setClinicalComplete(true);
    setClinicalAuthor({ name: "Tú", at: payload.clinical_at as string });
    onClinicalModeChange("view");
    router.refresh();
  }

  return (
    <>
      {intakeMode !== "closed" && (
        <ModalShell
          title="Antecedentes e interrogatorio"
          onClose={() => onIntakeModeChange("closed")}
          hint={
            intakeMode === "edit"
              ? 'Todos los campos son obligatorios (si no aplica, anótalo en vez de dejarlo vacío, ej. "Niega antecedentes de importancia").'
              : undefined
          }
        >
          <AuthorLine author={intakeAuthor} />
          <FieldGroup
            title="Antecedentes e interrogatorio"
            fields={intakeRequired}
            history={history}
            onChange={updateHistory}
            disabled={intakeMode === "view" || !canEditIntake}
          />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-slate-400">
              Tabaquismo, alcohol y otras sustancias (antecedentes personales
              patológicos)
            </p>
            <ToxicHabitCheck
              label="Tabaquismo"
              detailPlaceholder="Cuánto y desde cuándo (opcional)"
              checked={history.tobaccoUse}
              detail={history.tobaccoDetail}
              disabled={intakeMode === "view" || !canEditIntake}
              onCheckedChange={(v) => updateHistoryField("tobaccoUse", v)}
              onDetailChange={(v) => updateHistoryField("tobaccoDetail", v)}
            />
            <ToxicHabitCheck
              label="Alcoholismo"
              detailPlaceholder="Cuánto y desde cuándo (opcional)"
              checked={history.alcoholUse}
              detail={history.alcoholDetail}
              disabled={intakeMode === "view" || !canEditIntake}
              onCheckedChange={(v) => updateHistoryField("alcoholUse", v)}
              onDetailChange={(v) => updateHistoryField("alcoholDetail", v)}
            />
            <ToxicHabitCheck
              label="Otras sustancias psicoactivas"
              detailPlaceholder="Cuál, cuánto y desde cuándo (opcional)"
              checked={history.otherSubstancesUse}
              detail={history.otherSubstancesDetail}
              disabled={intakeMode === "view" || !canEditIntake}
              onCheckedChange={(v) => updateHistoryField("otherSubstancesUse", v)}
              onDetailChange={(v) => updateHistoryField("otherSubstancesDetail", v)}
            />
          </div>

          {intakeMode === "edit" && canEditIntake ? (
            <>
              {intakeError && <p className="text-sm text-red-600">{intakeError}</p>}
              {intakeSaved && !intakeError && (
                <p className="text-sm text-green-700">Guardado.</p>
              )}
              <button
                type="button"
                onClick={saveIntake}
                disabled={savingIntake}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {savingIntake ? "Guardando..." : "Guardar antecedentes"}
              </button>
            </>
          ) : (
            canEditIntake && (
              <button
                type="button"
                onClick={() => onIntakeModeChange("edit")}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Editar
              </button>
            )
          )}
        </ModalShell>
      )}

      {clinicalMode !== "closed" && (
        <ModalShell
          title="Exploración y diagnóstico"
          onClose={() => onClinicalModeChange("closed")}
          hint={
            clinicalMode === "edit"
              ? "Exclusivo del doctor. Todos los campos son obligatorios (si no aplica, anótalo en vez de dejarlo vacío)."
              : undefined
          }
        >
          <AuthorLine author={clinicalAuthor} />
          <FieldGroup
            title="Exploración y diagnóstico"
            fields={clinicalRequired}
            optionalFields={clinicalOptional}
            history={history}
            onChange={updateHistory}
            disabled={clinicalMode === "view" || !canEditClinical}
          />

          {clinicalMode === "edit" && canEditClinical ? (
            <>
              {clinicalError && <p className="text-sm text-red-600">{clinicalError}</p>}
              {clinicalSaved && !clinicalError && (
                <p className="text-sm text-green-700">Guardado.</p>
              )}
              <button
                type="button"
                onClick={saveClinical}
                disabled={savingClinical}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {savingClinical ? "Guardando..." : "Guardar exploración y diagnóstico"}
              </button>
            </>
          ) : (
            canEditClinical && (
              <button
                type="button"
                onClick={() => onClinicalModeChange("edit")}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Editar
              </button>
            )
          )}
        </ModalShell>
      )}

      {identificationOpen && (
        <ModalShell
          title="Ficha de identificación"
          onClose={() => onIdentificationOpenChange(false)}
        >
          <div className="grid grid-cols-2 gap-3">
            {IDENTIFICATION_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  {f.label}
                </label>
                {textInput(f, identification[f.key], (v) =>
                  setIdentification((prev) => ({ ...prev, [f.key]: v }))
                )}
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Grupo étnico (opcional)
            </label>
            <select
              value={identification.ethnicGroup}
              onChange={(e) =>
                setIdentification((prev) => ({
                  ...prev,
                  ethnicGroup: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Sin especificar</option>
              {ETHNIC_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
            {identification.ethnicGroup === "otro" && (
              <input
                value={identification.ethnicGroupDetail}
                onChange={(e) =>
                  setIdentification((prev) => ({
                    ...prev,
                    ethnicGroupDetail: e.target.value,
                  }))
                }
                placeholder="Especifique"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            )}
          </div>

          {identificationError && (
            <p className="text-sm text-red-600">{identificationError}</p>
          )}
          {identificationSaved && !identificationError && (
            <p className="text-sm text-green-700">Guardado.</p>
          )}
          <button
            type="button"
            onClick={saveIdentification}
            disabled={savingIdentification}
            className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {savingIdentification ? "Guardando..." : "Guardar datos de identificación"}
          </button>
        </ModalShell>
      )}
    </>
  );
}
