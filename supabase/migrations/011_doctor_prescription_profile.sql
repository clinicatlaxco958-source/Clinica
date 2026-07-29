-- ============================================================
-- Migración 011: datos del doctor para el encabezado de la receta
-- impresa (universidad, cédula profesional, logo) + bucket de Storage
-- para el logo. Seguro de volver a correr.
-- ============================================================

alter table doctors add column if not exists university text;
alter table doctors add column if not exists license_number text;
alter table doctors add column if not exists logo_url text;

-- Bucket público (son solo imágenes de logo, sin datos sensibles) para
-- que cada doctor suba su logo desde /dashboard/perfil.
insert into storage.buckets (id, name, public)
values ('doctor-logos', 'doctor-logos', true)
on conflict (id) do nothing;

-- Un doctor solo puede subir/editar/borrar objetos dentro de su propia
-- carpeta (convención de path: `${auth.uid()}/logo.<ext>`).
drop policy if exists "doctor manage own logo" on storage.objects;
create policy "doctor manage own logo" on storage.objects
  for all using (
    bucket_id = 'doctor-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'doctor-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lectura pública (el bucket ya es público, pero se agrega la política
-- explícita por si se consulta vía API en vez de la URL pública directa).
drop policy if exists "public read doctor logos" on storage.objects;
create policy "public read doctor logos" on storage.objects
  for select using (bucket_id = 'doctor-logos');
