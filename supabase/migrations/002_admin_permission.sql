-- ============================================================
-- Migración 002: separar "admin" (permiso) de "role" (función clínica)
-- + suspensión de usuarios (active) + políticas de gestión de staff
-- Ejecutar en el SQL Editor de un proyecto que YA tiene schema.sql
-- aplicado (proyectos nuevos ya incluyen esto en schema.sql).
-- Seguro de volver a correr (usa IF EXISTS / IF NOT EXISTS).
-- ============================================================

alter table users add column if not exists is_admin boolean not null default false;
alter table users add column if not exists active boolean not null default true;

-- Quitar el NOT NULL antes de poner role = null (orden importa).
alter table users alter column role drop not null;

-- Migrar filas existentes: quien tenía role='admin' pasa a ser
-- is_admin=true sin función clínica asignada todavía.
update users set is_admin = true where role = 'admin';
update users set role = null where role = 'admin';

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role is null or role in ('doctor', 'receptionist'));

-- La suspensión (active=false) bloquea el acceso a TODOS los datos vía
-- RLS, no solo el login: auth_clinic_id() ya no resuelve nada para un
-- usuario inactivo, así que ninguna política "clinic_id = auth_clinic_id()"
-- puede cumplirse para él.
create or replace function auth_clinic_id()
returns uuid
language sql
security definer
stable
as $$
  select clinic_id from users where id = auth.uid() and active = true
$$;

-- Helper: ¿el usuario autenticado tiene permiso de administrador?
create or replace function auth_is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_admin from users where id = auth.uid() and active = true),
    false
  )
$$;

-- Solo un admin puede crear, editar o eliminar staff de su propia clínica.
-- (La política de "select" ya existente no cambia: cualquier miembro de
-- la clínica puede ver la lista de su propio staff.)
drop policy if exists "admin manage users insert" on users;
create policy "admin manage users insert" on users
  for insert with check (clinic_id = auth_clinic_id() and auth_is_admin());

drop policy if exists "admin manage users update" on users;
create policy "admin manage users update" on users
  for update using (clinic_id = auth_clinic_id() and auth_is_admin());

drop policy if exists "admin manage users delete" on users;
create policy "admin manage users delete" on users
  for delete using (clinic_id = auth_clinic_id() and auth_is_admin());
