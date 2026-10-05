-- ============================================================
-- Migración 019: auditoría/trazabilidad de cambios clínicos (Fase 3,
-- ver NEGOCIO.md sección 13) — NOM-024 exige que ninguna nota clínica
-- se pueda sobreescribir sin dejar rastro de qué decía antes.
--
-- No se cambia cómo edita el doctor/enfermería (siguen "guardando"
-- normal, sin fricción nueva) — antes de cada UPDATE en `consultations`
-- o `medical_histories`, un trigger copia la fila COMO ESTABA a
-- `clinical_audit_log`. Es un archivo histórico, no una pantalla de uso
-- diario: por ahora solo admin puede consultarlo (sin política de
-- insert/update/delete — nadie más que el propio trigger, que corre con
-- privilegios de quien creó la función, puede escribir ahí; mismo
-- espíritu que el kardex inmutable de `pharmacy_movements`).
--
-- `consultations.updated_by` + los ya existentes `medical_histories`.
-- `intake_by`/`clinical_by` (migración 018) cubren "quién hizo el
-- último cambio"; este archivo cubre "qué decía antes de ese cambio".
--
-- Seguro de volver a correr.
-- ============================================================

alter table consultations add column if not exists updated_by uuid references users(id);

create table if not exists clinical_audit_log (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  changed_by uuid references users(id),
  changed_at timestamptz not null default now(),
  -- Snapshot completo de la fila ANTES del cambio (to_jsonb(old) en el
  -- trigger) — no solo los campos que cambiaron, para no tener que
  -- adivinar el resto del contexto de esa versión anterior.
  previous_data jsonb not null
);

create index if not exists idx_clinical_audit_log_record
  on clinical_audit_log(table_name, record_id);

alter table clinical_audit_log enable row level security;

drop policy if exists "clinical_audit_log select" on clinical_audit_log;
create policy "clinical_audit_log select" on clinical_audit_log
  for select using (clinic_id = auth_clinic_id() and auth_is_admin());

-- security definer: el trigger debe poder insertar el registro de
-- auditoría sin importar los permisos de escritura de quien esté
-- guardando (enfermería, doctor, admin) — nadie tiene permiso directo
-- de insert/update/delete sobre clinical_audit_log, solo este trigger.
create or replace function log_clinical_audit()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into clinical_audit_log (clinic_id, table_name, record_id, changed_by, previous_data)
  values (old.clinic_id, tg_table_name, old.id, auth.uid(), to_jsonb(old));
  return new;
end;
$$;

drop trigger if exists consultations_audit on consultations;
create trigger consultations_audit
  before update on consultations
  for each row execute function log_clinical_audit();

drop trigger if exists medical_histories_audit on medical_histories;
create trigger medical_histories_audit
  before update on medical_histories
  for each row execute function log_clinical_audit();
