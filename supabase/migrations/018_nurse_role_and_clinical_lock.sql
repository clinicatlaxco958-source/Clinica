-- ============================================================
-- Migración 018: rol de enfermería + candado duro de "juicio clínico"
-- en `medical_histories` (ver NEGOCIO.md sección 13).
--
-- Contexto: el Doctor quiere que el interrogatorio/antecedentes de la
-- primera visita se capturen en el lobby ANTES de pasar a consulta, para
-- no quitarle tiempo de consultorio. Eso es válido según NOM-004 si lo
-- hace personal de salud (enfermería), NO una recepcionista/secretaria
-- administrativa (sin formación clínica). Por eso se agrega un rol
-- nuevo `nurse`, separado de `receptionist` — una clínica puede tener
-- ambas figuras a la vez.
--
-- Aun con el rol de enfermería, hay una parte de la historia clínica
-- que NO se puede delegar sin importar el nombre del rol: exploración
-- física, diagnóstico, pronóstico y plan de tratamiento (y sus
-- equivalentes dentales) son juicio clínico reservado al médico por ley
-- (no solo por NOM-004). Documentarlo no basta — se bloquea con un
-- trigger a nivel de base de datos, porque aquí el costo de un error
-- (un "diagnóstico" atribuible a alguien sin cédula médica) es mayor que
-- en un campo de texto libre cualquiera.
--
-- Seguro de volver a correr.
-- ============================================================

-- Rol nuevo: enfermería / auxiliar clínico. Independiente de
-- is_admin/is_pharmacy (mismo patrón que el resto de permisos).
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role is null or role in ('doctor', 'receptionist', 'nurse'));

-- Función helper: ¿el usuario autenticado tiene rol de enfermería?
-- Calco de auth_is_pharmacy()/auth_is_admin().
create or replace function auth_is_nurse()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select role = 'nurse' from users where id = auth.uid() and active = true),
    false
  )
$$;

-- Trazabilidad mínima: quién capturó el interrogatorio/antecedentes
-- (enfermería o el propio doctor) y quién capturó/validó la parte de
-- juicio clínico (siempre un doctor). Es una versión adelantada y
-- acotada de lo que se planeó como Fase 3 (auditoría) — se trae ahora
-- porque, al permitir que dos roles distintos escriban en el mismo
-- registro, NOM-004 exige poder identificar quién elaboró cada parte
-- (no solo "quién guardó por última vez").
alter table medical_histories add column if not exists intake_by uuid references users(id);
alter table medical_histories add column if not exists intake_at timestamptz;
alter table medical_histories add column if not exists clinical_by uuid references users(id);
alter table medical_histories add column if not exists clinical_at timestamptz;

-- Enfermería puede ver y crear/ampliar la historia clínica (para poder
-- capturar el interrogatorio en el lobby antes de la consulta), con el
-- mismo criterio de "toda la clínica" que ya aplica a doctor/admin.
drop policy if exists "medical_histories select" on medical_histories;
create policy "medical_histories select" on medical_histories
  for select using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is not null or auth_is_nurse())
  );

drop policy if exists "medical_histories insert" on medical_histories;
create policy "medical_histories insert" on medical_histories
  for insert with check (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is not null or auth_is_nurse())
  );

drop policy if exists "medical_histories update" on medical_histories;
create policy "medical_histories update" on medical_histories
  for update using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is not null or auth_is_nurse())
  );

-- Candado duro: aunque la política de arriba deje pasar el UPDATE/INSERT
-- a nivel de fila, nadie que no sea doctor o admin puede tocar las
-- columnas de juicio clínico (exploración/diagnóstico/pronóstico/
-- tratamiento y sus equivalentes dentales) — ni siquiera llamando a la
-- API directo, saltándose la interfaz. Esto es intencionalmente más
-- estricto que el resto del proyecto (que en casos similares, ver
-- consultations.notes, confía solo en que la app no mande ese campo):
-- aquí el límite es "quién puede diagnosticar", una restricción legal
-- más fuerte que una nota clínica cualquiera.
create or replace function medical_histories_restrict_clinical_fields()
returns trigger
language plpgsql
as $$
declare
  touched_clinical boolean;
begin
  if auth_is_admin() or auth_doctor_id() is not null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    touched_clinical := (
      new.physical_exam is not null or
      new.diagnosis is not null or
      new.prognosis is not null or
      new.treatment_plan is not null or
      new.oral_exam is not null or
      new.dental_diagnosis is not null or
      new.dental_treatment_plan is not null or
      new.odontogram is not null or
      new.clinical_by is not null or
      new.clinical_at is not null
    );
  else
    touched_clinical := (
      new.physical_exam is distinct from old.physical_exam or
      new.diagnosis is distinct from old.diagnosis or
      new.prognosis is distinct from old.prognosis or
      new.treatment_plan is distinct from old.treatment_plan or
      new.oral_exam is distinct from old.oral_exam or
      new.dental_diagnosis is distinct from old.dental_diagnosis or
      new.dental_treatment_plan is distinct from old.dental_treatment_plan or
      new.odontogram is distinct from old.odontogram or
      new.clinical_by is distinct from old.clinical_by or
      new.clinical_at is distinct from old.clinical_at
    );
  end if;

  if touched_clinical then
    raise exception
      'Solo un doctor puede capturar exploración física, diagnóstico, pronóstico, plan de tratamiento u odontograma.';
  end if;

  return new;
end;
$$;

drop trigger if exists medical_histories_restrict_clinical_fields on medical_histories;
create trigger medical_histories_restrict_clinical_fields
  before insert or update on medical_histories
  for each row execute function medical_histories_restrict_clinical_fields();
