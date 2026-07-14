-- ============================================================
-- Migración 009: tabla `prescription_items` (medicamentos de la receta,
-- 1:muchos con appointments). A diferencia de `consultations`, solo el
-- doctor dueño de la cita (o admin) puede escribirla — recepción puede
-- ver la receta pero no prescribir.
-- Seguro de volver a correr.
-- ============================================================

create table if not exists prescription_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  medication_name text not null,
  frequency_hours integer not null check (frequency_hours > 0),
  duration_days integer not null check (duration_days > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_prescription_items_appointment
  on prescription_items(appointment_id);

alter table prescription_items enable row level security;

drop policy if exists "prescription_items select" on prescription_items;
drop policy if exists "prescription_items insert" on prescription_items;
drop policy if exists "prescription_items update" on prescription_items;
drop policy if exists "prescription_items delete" on prescription_items;

create policy "prescription_items select" on prescription_items
  for select using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = prescription_items.appointment_id
        and (auth_is_admin() or auth_doctor_id() is null or a.doctor_id = auth_doctor_id())
    )
  );
create policy "prescription_items insert" on prescription_items
  for insert with check (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = prescription_items.appointment_id
        and (auth_is_admin() or a.doctor_id = auth_doctor_id())
    )
  );
create policy "prescription_items update" on prescription_items
  for update using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = prescription_items.appointment_id
        and (auth_is_admin() or a.doctor_id = auth_doctor_id())
    )
  );
create policy "prescription_items delete" on prescription_items
  for delete using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = prescription_items.appointment_id
        and (auth_is_admin() or a.doctor_id = auth_doctor_id())
    )
  );
