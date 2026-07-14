-- ============================================================
-- Migración 005:
-- 1) Búsqueda/duplicados de pacientes sin distinguir acentos
--    (José = Jose).
-- 2) Un doctor solo puede editar su propia fila en `doctors`
--    (duración de consulta, especialidad); admin puede editar
--    cualquiera de su clínica.
-- Seguro de volver a correr.
-- ============================================================

create extension if not exists "unaccent";

create or replace function immutable_unaccent(text)
returns text
language sql
immutable
as $$
  select unaccent('unaccent', $1)
$$;

alter table patients add column if not exists first_name_search text
  generated always as (lower(immutable_unaccent(first_name))) stored;

alter table patients add column if not exists last_name_paternal_search text
  generated always as (lower(immutable_unaccent(last_name_paternal))) stored;

alter table patients add column if not exists full_name_search text
  generated always as (
    lower(immutable_unaccent(
      trim(both ' ' from
        first_name || ' ' || last_name_paternal ||
        coalesce(' ' || nullif(last_name_maternal, ''), '')
      )
    ))
  ) stored;

drop policy if exists "clinic isolation update" on doctors;
drop policy if exists "doctor or admin update" on doctors;
create policy "doctor or admin update" on doctors
  for update using (
    clinic_id = auth_clinic_id()
    and (user_id = auth.uid() or auth_is_admin())
  );
