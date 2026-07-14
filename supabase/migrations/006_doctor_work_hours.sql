-- ============================================================
-- Migración 006: hora de inicio/fin de jornada por doctor (y default
-- de clínica), para alinear la cuadrícula del calendario y las horas
-- disponibles al agendar a los intervalos reales del doctor.
-- Horario fijo por ahora (sin variar por día de la semana ni
-- excepciones — eso queda para una fase futura).
-- Seguro de volver a correr.
-- ============================================================

alter table clinics add column if not exists default_work_start_time time
  not null default '09:00';
alter table clinics add column if not exists default_work_end_time time
  not null default '18:00';

alter table doctors add column if not exists work_start_time time;
alter table doctors add column if not exists work_end_time time;

alter table doctors drop constraint if exists doctors_work_hours_check;
alter table doctors add constraint doctors_work_hours_check
  check (work_start_time is null or work_end_time is null or work_start_time < work_end_time);
