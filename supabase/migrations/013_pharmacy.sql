-- ============================================================
-- Migración 013: módulo de farmacia (inventario de medicamentos).
--
-- Catálogo de medicamentos por clínica (pharmacy_items) + kardex de
-- entradas/salidas (pharmacy_movements). El stock actual NO se guarda
-- como columna: se calcula sumando pharmacy_movements (entradas menos
-- salidas) para que no haya un contador que se pueda desincronizar del
-- historial real.
--
-- Acceso gestionado con un permiso nuevo y dedicado (users.is_pharmacy),
-- independiente de is_admin y de role — mismo patrón que is_admin, no se
-- ata a "ser recepcionista".
--
-- Seguro de volver a correr.
-- ============================================================

-- Permiso de administración de farmacia (mismo patrón que is_admin).
alter table users add column if not exists is_pharmacy boolean not null default false;

-- Función helper: ¿el usuario autenticado tiene permiso de farmacia?
-- Calco de auth_is_admin() — permiso independiente, no ligado a role.
create or replace function auth_is_pharmacy()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_pharmacy from users where id = auth.uid() and active = true),
    false
  )
$$;

-- ------------------------------------------------------------
-- Tabla: pharmacy_items (catálogo de medicamentos de farmacia interna,
-- por clínica). Stock solo en cajas/paquetes cerrados, sin conversión a
-- unidades individuales — box_description es texto libre (ej. "Caja con
-- 20 tabletas 500mg"). Sin columna de stock: se calcula sumando
-- pharmacy_movements.
-- ------------------------------------------------------------
create table if not exists pharmacy_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  box_description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);

-- ------------------------------------------------------------
-- Tabla: pharmacy_movements (kardex — entradas y salidas de cajas).
-- Registro inmutable: corregir un error se hace con un movimiento
-- contrario, no editando el historial (sin políticas de update/delete).
-- ------------------------------------------------------------
create table if not exists pharmacy_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  item_id uuid not null references pharmacy_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('entrada', 'salida')),
  quantity_boxes integer not null check (quantity_boxes > 0),
  patient_id uuid references patients(id) on delete set null,
  prescription_item_id uuid references prescription_items(id) on delete set null,
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_pharmacy_movements_item on pharmacy_movements(item_id);
create index if not exists idx_pharmacy_movements_clinic on pharmacy_movements(clinic_id);

-- Vínculo opcional desde la receta al catálogo de farmacia. medication_name
-- sigue siendo texto libre (el catálogo no es obligatorio); este campo solo
-- permite sugerir el medicamento con su stock al recetar y da trazabilidad
-- hacia pharmacy_movements cuando se dispensa.
alter table prescription_items add column if not exists pharmacy_item_id uuid references pharmacy_items(id) on delete set null;

-- ============================================================
-- RLS
-- ============================================================

alter table pharmacy_items enable row level security;
alter table pharmacy_movements enable row level security;

-- pharmacy_items: cualquiera con sesión en la clínica puede VER el
-- catálogo/stock; solo admin o quien tenga el permiso de farmacia puede
-- crear/editar. Sin política de delete: se descontinúa con active=false.
drop policy if exists "pharmacy_items select" on pharmacy_items;
create policy "pharmacy_items select" on pharmacy_items
  for select using (clinic_id = auth_clinic_id());

drop policy if exists "pharmacy_items insert" on pharmacy_items;
create policy "pharmacy_items insert" on pharmacy_items
  for insert with check (
    clinic_id = auth_clinic_id() and (auth_is_admin() or auth_is_pharmacy())
  );

drop policy if exists "pharmacy_items update" on pharmacy_items;
create policy "pharmacy_items update" on pharmacy_items
  for update using (
    clinic_id = auth_clinic_id() and (auth_is_admin() or auth_is_pharmacy())
  );

-- pharmacy_movements: mismo criterio de lectura amplia / escritura
-- restringida. Sin políticas de update/delete — kardex inmutable.
drop policy if exists "pharmacy_movements select" on pharmacy_movements;
create policy "pharmacy_movements select" on pharmacy_movements
  for select using (clinic_id = auth_clinic_id());

drop policy if exists "pharmacy_movements insert" on pharmacy_movements;
create policy "pharmacy_movements insert" on pharmacy_movements
  for insert with check (
    clinic_id = auth_clinic_id() and (auth_is_admin() or auth_is_pharmacy())
  );
