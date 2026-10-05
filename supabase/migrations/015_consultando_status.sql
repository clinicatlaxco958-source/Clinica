-- ============================================================
-- Migración 015: nuevo status de cita "consultando".
--
-- Se activa cuando el doctor dueño de la cita da clic en "Iniciar
-- consulta" (no cuando recepción solo captura signos vitales) — indica
-- que el doctor está atendiendo al paciente en este momento, distinto de
-- "confirmada" (todavía no ha empezado) y "completada" (ya terminó).
--
-- Seguro de volver a correr: el constraint se llama igual siempre
-- (nombre autogenerado por Postgres para un check sin nombre explícito
-- en la definición original de la tabla), así que se puede reemplazar.
-- ============================================================

alter table appointments drop constraint if exists appointments_status_check;

alter table appointments add constraint appointments_status_check
  check (status in ('pendiente', 'confirmada', 'consultando', 'completada', 'cancelada', 'no_show'));
