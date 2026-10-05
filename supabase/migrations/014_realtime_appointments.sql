-- ============================================================
-- Migración 014: habilita Supabase Realtime para appointments.
--
-- Sin esto, la agenda no se entera de citas creadas/editadas desde otra
-- sesión (otra secretaria, otro doctor) hasta que alguien navega y se
-- vuelve a pedir la lista. Con la tabla en la publicación
-- `supabase_realtime`, el cliente puede suscribirse a sus cambios vía
-- websocket — Supabase respeta las políticas RLS de la tabla también
-- para estas suscripciones, así que un doctor no-admin solo recibe
-- eventos de sus propias citas, igual que con una consulta normal.
--
-- Seguro de volver a correr (evita el error de agregar una tabla que ya
-- está en la publicación).
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table appointments;
  end if;
end $$;
