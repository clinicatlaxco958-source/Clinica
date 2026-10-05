-- ============================================================
-- Migración 021: tabaquismo/alcoholismo/otras sustancias psicoactivas
-- como checks estructurados dentro de "antecedentes personales
-- patológicos" (NOM-004-SSA3-2012, numeral 6.1.1 — la norma los ubica
-- ahí explícitamente, no en "no patológicos" como decía antes el
-- placeholder de la app). Ver NEGOCIO.md sección 13.
--
-- Columnas nuevas en `medical_histories`, parte del bloque "intake"
-- (las captura enfermería, doctor o admin, igual que el resto de
-- antecedentes) — no se agregan a la validación de "campo obligatorio"
-- porque un checkbox siempre tiene una respuesta válida (marcado o no),
-- a diferencia de un campo de texto que sí puede quedar vacío sin
-- responder.
--
-- Seguro de volver a correr.
-- ============================================================

alter table medical_histories add column if not exists tobacco_use boolean;
alter table medical_histories add column if not exists tobacco_detail text;
alter table medical_histories add column if not exists alcohol_use boolean;
alter table medical_histories add column if not exists alcohol_detail text;
alter table medical_histories add column if not exists other_substances_use boolean;
alter table medical_histories add column if not exists other_substances_detail text;
