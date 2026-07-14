-- ============================================================
-- Migración 008: tabla `consultations` (signos vitales + notas de
-- consulta, 1:1 con appointments). Mismo control de acceso que las
-- citas: un doctor no-admin solo ve/edita la de SUS propias citas;
-- admin y staff sin función de doctor (recepción) ven/editan cualquiera.
-- Seguro de volver a correr.
-- ============================================================

create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  weight_kg numeric(5, 2),
  height_cm numeric(5, 1),
  temperature_c numeric(4, 1),
  blood_pressure text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table consultations enable row level security;

drop policy if exists "consultations select" on consultations;
drop policy if exists "consultations insert" on consultations;
drop policy if exists "consultations update" on consultations;

create policy "consultations select" on consultations
  for select using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = consultations.appointment_id
        and (auth_is_admin() or auth_doctor_id() is null or a.doctor_id = auth_doctor_id())
    )
  );
create policy "consultations insert" on consultations
  for insert with check (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = consultations.appointment_id
        and (auth_is_admin() or auth_doctor_id() is null or a.doctor_id = auth_doctor_id())
    )
  );
create policy "consultations update" on consultations
  for update using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = consultations.appointment_id
        and (auth_is_admin() or auth_doctor_id() is null or a.doctor_id = auth_doctor_id())
    )
  );
