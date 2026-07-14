-- ============================================================
-- Migración 003: duración de consulta por doctor (y default de clínica)
-- Ejecutar en el SQL Editor de un proyecto que YA tiene schema.sql
-- aplicado (proyectos nuevos ya incluyen esto en schema.sql).
-- Seguro de volver a correr (usa IF NOT EXISTS).
-- ============================================================

alter table clinics add column if not exists default_appointment_duration_minutes
  integer not null default 30;

alter table clinics drop constraint if exists clinics_default_appointment_duration_minutes_check;
alter table clinics add constraint clinics_default_appointment_duration_minutes_check
  check (default_appointment_duration_minutes > 0);

alter table doctors add column if not exists default_duration_minutes integer;

alter table doctors drop constraint if exists doctors_default_duration_minutes_check;
alter table doctors add constraint doctors_default_duration_minutes_check
  check (default_duration_minutes is null or default_duration_minutes > 0);
