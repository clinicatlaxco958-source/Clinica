-- ============================================================
-- Migración 007: un doctor (no-admin) solo puede ver/crear/editar/
-- eliminar SUS PROPIAS citas — no las de otros doctores de la clínica.
-- Admin y staff sin función de doctor (ej. recepción) siguen viendo y
-- gestionando las citas de todos los doctores.
-- Seguro de volver a correr.
-- ============================================================

create or replace function auth_doctor_id()
returns uuid
language sql
security definer
stable
as $$
  select id from doctors where user_id = auth.uid()
$$;

drop policy if exists "clinic isolation select" on appointments;
drop policy if exists "clinic isolation insert" on appointments;
drop policy if exists "clinic isolation update" on appointments;
drop policy if exists "clinic isolation delete" on appointments;
drop policy if exists "appointments select" on appointments;
drop policy if exists "appointments insert" on appointments;
drop policy if exists "appointments update" on appointments;
drop policy if exists "appointments delete" on appointments;

create policy "appointments select" on appointments
  for select using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id())
  );
create policy "appointments insert" on appointments
  for insert with check (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id())
  );
create policy "appointments update" on appointments
  for update using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id())
  );
create policy "appointments delete" on appointments
  for delete using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id())
  );
