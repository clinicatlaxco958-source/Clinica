-- ============================================================
-- Migración 022: frecuencia cardiaca y frecuencia respiratoria en
-- signos vitales. NOM-004-SSA3-2012 numeral 6.1.2 exige explícitamente
-- que la exploración física incluya temperatura, tensión arterial,
-- frecuencia cardiaca Y frecuencia respiratoria — hasta ahora
-- `consultations` solo capturaba temperatura y presión arterial (junto
-- con peso y talla), faltaban estas dos. Ver NEGOCIO.md sección 13.
--
-- Seguro de volver a correr.
-- ============================================================

alter table consultations add column if not exists heart_rate_bpm integer
  check (heart_rate_bpm is null or heart_rate_bpm > 0);
alter table consultations add column if not exists respiratory_rate_rpm integer
  check (respiratory_rate_rpm is null or respiratory_rate_rpm > 0);
