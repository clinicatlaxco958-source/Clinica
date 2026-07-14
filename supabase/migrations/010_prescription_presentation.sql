-- ============================================================
-- Migración 010: forma de presentación del medicamento (tableta,
-- cápsula, jarabe, gotas, inyección, crema, u "otro" con instrucción
-- libre), para armar la frase de la receta correctamente según el tipo.
-- Seguro de volver a correr.
-- ============================================================

alter table prescription_items add column if not exists presentation text
  not null default 'tableta';

alter table prescription_items drop constraint if exists prescription_items_presentation_check;
alter table prescription_items add constraint prescription_items_presentation_check
  check (presentation in ('tableta', 'capsula', 'jarabe', 'gotas', 'inyeccion', 'crema', 'otro'));

alter table prescription_items add column if not exists quantity numeric(6, 2);
alter table prescription_items add column if not exists custom_instruction text;
