-- ============================================================
-- Migración 016: ficha de identificación completa del paciente,
-- conforme a NOM-004-SSA3-2012 (ver NEGOCIO.md sección 13).
--
-- Todas las columnas son opcionales (nullable) a propósito: son datos
-- administrativos que pueden depender de que el paciente traiga un
-- documento a la mano (ej. CURP) — a diferencia del núcleo clínico
-- (antecedentes, exploración, diagnóstico), que se captura sí o sí en la
-- primera consulta y vive en la tabla `medical_histories` de la
-- siguiente migración. Estas sí pueden quedar pendientes y completarse
-- en visitas posteriores (recordatorio, Fase 2).
--
-- Seguro de volver a correr.
-- ============================================================

alter table patients add column if not exists sex text;
alter table patients drop constraint if exists patients_sex_check;
alter table patients add constraint patients_sex_check
  check (sex in ('femenino', 'masculino'));

-- CURP: 18 caracteres, letras mayúsculas y dígitos. La app debe
-- normalizar a mayúsculas antes de guardar (mismo espíritu que la
-- normalización de nombres para búsqueda, ver *_search en este mismo
-- archivo más arriba).
alter table patients add column if not exists curp text;
alter table patients drop constraint if exists patients_curp_check;
alter table patients add constraint patients_curp_check
  check (curp ~ '^[A-Z0-9]{18}$');

alter table patients add column if not exists address text;
alter table patients add column if not exists occupation text;

alter table patients add column if not exists marital_status text;
alter table patients drop constraint if exists patients_marital_status_check;
alter table patients add constraint patients_marital_status_check
  check (marital_status in ('soltero', 'casado', 'union_libre', 'divorciado', 'viudo'));

alter table patients add column if not exists blood_type text;
alter table patients drop constraint if exists patients_blood_type_check;
alter table patients add constraint patients_blood_type_check
  check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));

alter table patients add column if not exists emergency_contact_name text;
alter table patients add column if not exists emergency_contact_phone text;
