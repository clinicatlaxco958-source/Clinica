-- ============================================================
-- Migración 004: separar nombre de paciente en Nombre(s) / Apellido
-- paterno / Apellido materno, y hacer fecha de nacimiento obligatoria.
-- full_name pasa a ser una columna calculada (ya no se inserta directo).
--
-- IMPORTANTE: si ya tienes pacientes de prueba capturados con el
-- formulario viejo (solo full_name, sin fecha de nacimiento), esta
-- migración va a fallar en el paso de "set not null" porque esas filas
-- no cumplen los nuevos campos obligatorios. Bórralos primero en
-- Table Editor > patients (son datos de prueba, no de producción) y
-- luego corre este archivo completo.
-- ============================================================

alter table patients add column if not exists first_name text;
alter table patients add column if not exists last_name_paternal text;
alter table patients add column if not exists last_name_maternal text;

alter table patients alter column first_name set not null;
alter table patients alter column last_name_paternal set not null;
alter table patients alter column birth_date set not null;

alter table patients drop column if exists full_name;
alter table patients add column full_name text generated always as (
  trim(both ' ' from
    first_name || ' ' || last_name_paternal ||
    coalesce(' ' || nullif(last_name_maternal, ''), '')
  )
) stored;
