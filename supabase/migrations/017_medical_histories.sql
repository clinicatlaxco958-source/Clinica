-- ============================================================
-- Migración 017: historia clínica — núcleo obligatorio de
-- NOM-004-SSA3-2012 (ver NEGOCIO.md sección 13). Una fila por PACIENTE
-- (no por cita, a diferencia de `consultations`): antecedentes,
-- exploración y diagnóstico son del paciente y se consultan/amplían en
-- cualquier visita futura, no solo en la que se crearon.
--
-- Todas las columnas son texto libre y nullable a nivel de base de
-- datos, a propósito (mismo criterio que consultations.notes): que el
-- núcleo clínico deba llenarse "sí o sí" en la primera consulta se
-- exige en la app (validación antes de guardar), no con NOT NULL, para
-- no bloquear ediciones/ampliaciones parciales en visitas posteriores
-- (ej. una alergia nueva que aparece después).
--
-- `clinics.type` decide qué secciones aplican en la UI: 'medica' pide
-- los campos de exploración médica, 'dental' los de exploración dental,
-- 'mixta' ambos. El núcleo común (antecedentes, alergias) aplica
-- siempre.
--
-- Sin política de DELETE a propósito: un expediente clínico no debe
-- poder borrarse (alineado con la conservación que exige NOM-024) — sin
-- policy para delete, RLS lo bloquea por default para cualquier rol que
-- no sea el dueño de la tabla.
--
-- Seguro de volver a correr.
-- ============================================================

create table if not exists medical_histories (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references patients(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,

  -- Núcleo común (todas las clínicas, NOM-004)
  heredo_familiares text,
  personales_no_patologicos text,
  personales_patologicos text,
  allergies text,

  -- Exploración médica (clinics.type = 'medica' o 'mixta')
  present_illness text,
  systems_review text,
  physical_exam text,
  previous_studies text,
  diagnosis text,
  prognosis text,
  treatment_plan text,

  -- Exploración dental (clinics.type = 'dental' o 'mixta'). odontogram
  -- es texto libre en esta primera versión — un mapa visual interactivo
  -- de 32 piezas es un componente aparte, se evalúa después si hace
  -- falta (ver NEGOCIO.md sección 13).
  dental_history text,
  oral_exam text,
  odontogram text,
  dental_diagnosis text,
  dental_treatment_plan text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table medical_histories enable row level security;

-- Cualquier doctor de la clínica (o admin) puede VER y EDITAR la
-- historia clínica de cualquier paciente de su clínica — a propósito
-- distinto de `consultations` (que restringe a "solo el doctor dueño de
-- la cita"): el propósito de NOM-004 es continuidad de atención entre
-- doctores de la misma clínica, no un cuaderno privado por doctor.
-- Recepción (auth_doctor_id() is null y no admin) no ve ni edita este
-- contenido clínico — sí puede seguir capturando los datos
-- administrativos de `patients` (ficha de identificación, migración
-- 016), que usan la política genérica de esa tabla, sin este candado.
create policy "medical_histories select" on medical_histories
  for select using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is not null)
  );

create policy "medical_histories insert" on medical_histories
  for insert with check (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is not null)
  );

create policy "medical_histories update" on medical_histories
  for update using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is not null)
  );
