-- ============================================================
-- Migración 012: marca de agua del doctor para la receta impresa.
-- Reutiliza el bucket `doctor-logos` (creado en la migración 011) y
-- sus mismas políticas RLS por carpeta de `auth.uid()` — no se
-- necesita bucket ni política nueva, solo la columna.
-- Seguro de volver a correr.
-- ============================================================

alter table doctors add column if not exists watermark_url text;
