-- ============================================================
-- ClinicSaaS - Schema inicial (multi-tenant)
-- Ejecutar esto en el SQL Editor de tu proyecto Supabase
-- ============================================================

-- Extensión para UUIDs
create extension if not exists "pgcrypto";

-- Extensión para búsquedas sin distinguir acentos (José = Jose)
create extension if not exists "unaccent";

-- unaccent() de Postgres es STABLE, no IMMUTABLE, así que no se puede usar
-- directo en una columna generada. Este wrapper fija el diccionario y sí
-- se puede marcar IMMUTABLE (patrón estándar recomendado por Postgres).
create or replace function immutable_unaccent(text)
returns text
language sql
immutable
as $$
  select unaccent('unaccent', $1)
$$;

-- ------------------------------------------------------------
-- Tabla: clinics
-- ------------------------------------------------------------
create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('medica', 'dental', 'mixta')),
  phone text,
  address text,
  -- Duración default de consulta (min) cuando un doctor no define la suya.
  default_appointment_duration_minutes integer not null default 30
    check (default_appointment_duration_minutes > 0),
  -- Jornada default cuando un doctor no define la suya.
  default_work_start_time time not null default '09:00',
  default_work_end_time time not null default '18:00',
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: users (staff de cada clínica)
-- Vinculada 1 a 1 con auth.users de Supabase
-- ------------------------------------------------------------
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  full_name text not null,
  -- función clínica (independiente del permiso de administrador, ver is_admin)
  role text check (role in ('doctor', 'receptionist')),
  is_admin boolean not null default false,
  -- Permiso de administración de farmacia (mismo patrón que is_admin:
  -- independiente de role, no se ata a "ser recepcionista").
  is_pharmacy boolean not null default false,
  active boolean not null default true,
  phone text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: doctors (perfil extendido si el user es doctor)
-- ------------------------------------------------------------
create table doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  specialty text,
  -- Duración de consulta (min) de este doctor. Si es null, se usa
  -- clinics.default_appointment_duration_minutes.
  default_duration_minutes integer check (default_duration_minutes > 0),
  -- Jornada de este doctor. Si es null, se usa el default de la clínica.
  -- Horario fijo por ahora (sin variar por día de la semana ni excepciones).
  work_start_time time,
  work_end_time time,
  -- Datos para el encabezado de la receta impresa.
  university text,
  license_number text,
  logo_url text,
  -- Marca de agua de fondo de la receta impresa (mismo bucket que logo_url).
  watermark_url text,
  created_at timestamptz not null default now(),
  constraint doctors_work_hours_check
    check (work_start_time is null or work_end_time is null or work_start_time < work_end_time)
);

-- ------------------------------------------------------------
-- Tabla: patients
-- ------------------------------------------------------------
create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  first_name text not null,
  last_name_paternal text not null,
  last_name_maternal text,
  -- Calculado a partir de los 3 campos de arriba; no se inserta directo.
  full_name text generated always as (
    trim(both ' ' from
      first_name || ' ' || last_name_paternal ||
      coalesce(' ' || nullif(last_name_maternal, ''), '')
    )
  ) stored,
  -- Columnas normalizadas (minúsculas, sin acentos) para búsqueda y
  -- detección de duplicados que no distinga "José" de "Jose".
  first_name_search text generated always as (
    lower(immutable_unaccent(first_name))
  ) stored,
  last_name_paternal_search text generated always as (
    lower(immutable_unaccent(last_name_paternal))
  ) stored,
  full_name_search text generated always as (
    lower(immutable_unaccent(
      trim(both ' ' from
        first_name || ' ' || last_name_paternal ||
        coalesce(' ' || nullif(last_name_maternal, ''), '')
      )
    ))
  ) stored,
  phone text,
  email text,
  birth_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: appointments
-- ------------------------------------------------------------
create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  doctor_id uuid references doctors(id) on delete set null,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'confirmada', 'completada', 'cancelada', 'no_show')),
  payment_status text not null default 'pendiente'
    check (payment_status in ('pagado', 'pendiente')),
  notes text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: consultations (signos vitales + notas de consulta, 1:1 con
-- appointments). MVP mínimo: se amplía según lo que el doctor realmente
-- use en el día a día.
-- ------------------------------------------------------------
create table consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  weight_kg numeric(5, 2),
  height_cm numeric(5, 1),
  temperature_c numeric(4, 1),
  blood_pressure text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Tabla: pharmacy_items (catálogo de medicamentos de farmacia interna,
-- por clínica). El stock se lleva solo en cajas/paquetes cerrados, sin
-- conversión a unidades individuales (tabletas/mL) — box_description es
-- texto libre para anotar el contenido de la caja (ej. "Caja con 20
-- tabletas 500mg"). El stock actual NO se guarda como columna aquí: se
-- calcula sumando pharmacy_movements (entradas menos salidas) para que
-- no haya un contador que se pueda desincronizar del historial real.
-- ------------------------------------------------------------
create table pharmacy_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  box_description text,
  -- Descontinuar un medicamento no borra su historial de movimientos ni
  -- el vínculo desde recetas pasadas (mismo espíritu que users.active).
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, name)
);

-- ------------------------------------------------------------
-- Tabla: prescription_items (medicamentos de la receta, 1:muchos con
-- appointments). Solo el doctor de la cita (o admin) puede escribirla —
-- a diferencia de consultations, recepción no prescribe.
-- ------------------------------------------------------------
create table prescription_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  medication_name text not null,
  -- Forma farmacéutica: determina el verbo/unidad al armar la receta
  -- ("Tomar 1 tableta", "Aplicar 5 gotas"...). 'otro' usa custom_instruction
  -- en vez de cantidad+presentación (ej. cremas, instrucciones no numéricas).
  presentation text not null default 'tableta'
    check (presentation in ('tableta', 'capsula', 'jarabe', 'gotas', 'inyeccion', 'crema', 'otro')),
  quantity numeric(6, 2),
  custom_instruction text,
  frequency_hours integer not null check (frequency_hours > 0),
  duration_days integer not null check (duration_days > 0),
  -- Vínculo opcional al catálogo de farmacia. medication_name sigue
  -- siendo texto libre (el catálogo no es obligatorio); este campo solo
  -- permite sugerir el medicamento con su stock al recetar y da
  -- trazabilidad hacia pharmacy_movements cuando se dispensa.
  pharmacy_item_id uuid references pharmacy_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_prescription_items_appointment on prescription_items(appointment_id);

-- ------------------------------------------------------------
-- Tabla: pharmacy_movements (kardex — entradas y salidas de cajas de
-- farmacia). Es la fuente de verdad del stock (ver pharmacy_items).
-- Registro inmutable (sin políticas de update/delete más abajo):
-- corregir un error se hace con un movimiento contrario, no editando el
-- historial.
-- ------------------------------------------------------------
create table pharmacy_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  item_id uuid not null references pharmacy_items(id) on delete cascade,
  movement_type text not null check (movement_type in ('entrada', 'salida')),
  quantity_boxes integer not null check (quantity_boxes > 0),
  -- Paciente al que se le entregó (obligatorio a nivel app solo para
  -- salidas; null en entradas).
  patient_id uuid references patients(id) on delete set null,
  -- Vínculo opcional de trazabilidad a la línea de receta que originó la
  -- salida (dispensar es un paso aparte de recetar).
  prescription_item_id uuid references prescription_items(id) on delete set null,
  notes text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_pharmacy_movements_item on pharmacy_movements(item_id);
create index idx_pharmacy_movements_clinic on pharmacy_movements(clinic_id);

-- Índices útiles para las consultas más comunes
create index idx_appointments_clinic_date on appointments(clinic_id, date);
create index idx_patients_clinic on patients(clinic_id);
create index idx_users_clinic on users(clinic_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Cada clínica solo puede ver/modificar sus propios datos
-- ============================================================

alter table clinics enable row level security;
alter table users enable row level security;
alter table doctors enable row level security;
alter table patients enable row level security;
alter table appointments enable row level security;
alter table consultations enable row level security;
alter table prescription_items enable row level security;
alter table pharmacy_items enable row level security;
alter table pharmacy_movements enable row level security;

-- Función helper: obtiene el clinic_id del usuario autenticado actual.
-- Un usuario suspendido (active=false) no resuelve clinic_id, así que
-- automáticamente pierde acceso a TODO lo protegido por RLS, no solo el
-- login.
create or replace function auth_clinic_id()
returns uuid
language sql
security definer
stable
as $$
  select clinic_id from users where id = auth.uid() and active = true
$$;

-- Función helper: ¿el usuario autenticado tiene permiso de administrador?
-- "admin" es un permiso, no una función clínica (ver columna role) — un
-- doctor o recepcionista puede además ser admin.
create or replace function auth_is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_admin from users where id = auth.uid() and active = true),
    false
  )
$$;

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

-- Función helper: id de `doctors` del usuario autenticado, o null si no
-- es doctor (recepcionista, admin sin función clínica, etc.)
create or replace function auth_doctor_id()
returns uuid
language sql
security definer
stable
as $$
  select id from doctors where user_id = auth.uid()
$$;

-- Política: un usuario solo ve su propia clínica
create policy "select own clinic" on clinics
  for select using (id = auth_clinic_id());

-- Políticas: users solo ve staff de su misma clínica
create policy "select same clinic users" on users
  for select using (clinic_id = auth_clinic_id());

-- Solo un admin puede crear, editar o eliminar staff de su propia clínica
create policy "admin manage users insert" on users
  for insert with check (clinic_id = auth_clinic_id() and auth_is_admin());
create policy "admin manage users update" on users
  for update using (clinic_id = auth_clinic_id() and auth_is_admin());
create policy "admin manage users delete" on users
  for delete using (clinic_id = auth_clinic_id() and auth_is_admin());

-- Políticas genéricas por tabla (select/insert/update/delete
-- limitado a la clínica del usuario autenticado)
create policy "clinic isolation select" on doctors
  for select using (clinic_id = auth_clinic_id());
create policy "clinic isolation insert" on doctors
  for insert with check (clinic_id = auth_clinic_id());
-- Un doctor solo puede editar su propia fila (ej. duración de consulta,
-- especialidad); un admin puede editar cualquier doctor de su clínica.
create policy "doctor or admin update" on doctors
  for update using (
    clinic_id = auth_clinic_id()
    and (user_id = auth.uid() or auth_is_admin())
  );
create policy "clinic isolation delete" on doctors
  for delete using (clinic_id = auth_clinic_id());

create policy "clinic isolation select" on patients
  for select using (clinic_id = auth_clinic_id());
create policy "clinic isolation insert" on patients
  for insert with check (clinic_id = auth_clinic_id());
create policy "clinic isolation update" on patients
  for update using (clinic_id = auth_clinic_id());
create policy "clinic isolation delete" on patients
  for delete using (clinic_id = auth_clinic_id());

-- Un doctor (no-admin) solo ve/crea/edita/elimina SUS PROPIAS citas.
-- Admin y cualquier staff sin función de doctor (ej. recepción) ven y
-- gestionan las citas de todos los doctores de la clínica.
create policy "appointments select" on appointments
  for select using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id())
  );
create policy "appointments insert" on appointments
  for insert with check (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id())
  );
create policy "appointments update" on appointments
  for update using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id())
  );
create policy "appointments delete" on appointments
  for delete using (
    clinic_id = auth_clinic_id()
    and (auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id())
  );

-- consultations sigue la misma regla de acceso que su cita: un doctor
-- (no-admin) solo ve/edita la consulta de SUS PROPIAS citas; admin y
-- staff sin función de doctor (recepción) ven y editan cualquiera.
create policy "consultations select" on consultations
  for select using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = consultations.appointment_id
        and (auth_is_admin() or auth_doctor_id() is null or a.doctor_id = auth_doctor_id())
    )
  );
create policy "consultations insert" on consultations
  for insert with check (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = consultations.appointment_id
        and (auth_is_admin() or auth_doctor_id() is null or a.doctor_id = auth_doctor_id())
    )
  );
create policy "consultations update" on consultations
  for update using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = consultations.appointment_id
        and (auth_is_admin() or auth_doctor_id() is null or a.doctor_id = auth_doctor_id())
    )
  );

-- prescription_items: cualquiera con acceso a la cita puede VER la
-- receta (recepción puede necesitar consultarla), pero solo el doctor
-- dueño de la cita (o admin) puede escribirla — prescribir es una
-- acción clínica exclusiva del doctor.
create policy "prescription_items select" on prescription_items
  for select using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = prescription_items.appointment_id
        and (auth_is_admin() or auth_doctor_id() is null or a.doctor_id = auth_doctor_id())
    )
  );
create policy "prescription_items insert" on prescription_items
  for insert with check (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = prescription_items.appointment_id
        and (auth_is_admin() or a.doctor_id = auth_doctor_id())
    )
  );
create policy "prescription_items update" on prescription_items
  for update using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = prescription_items.appointment_id
        and (auth_is_admin() or a.doctor_id = auth_doctor_id())
    )
  );
create policy "prescription_items delete" on prescription_items
  for delete using (
    clinic_id = auth_clinic_id()
    and exists (
      select 1 from appointments a
      where a.id = prescription_items.appointment_id
        and (auth_is_admin() or a.doctor_id = auth_doctor_id())
    )
  );

-- pharmacy_items: cualquiera con sesión en la clínica puede VER el
-- catálogo/stock (un doctor necesita saber qué hay disponible al
-- recetar); solo admin o quien tenga el permiso de farmacia puede
-- crear/editar (descontinuar). Sin política de delete: un medicamento se
-- descontinúa con active=false, no se borra (rompería la referencia
-- desde movimientos/recetas pasadas).
create policy "pharmacy_items select" on pharmacy_items
  for select using (clinic_id = auth_clinic_id());
create policy "pharmacy_items insert" on pharmacy_items
  for insert with check (
    clinic_id = auth_clinic_id() and (auth_is_admin() or auth_is_pharmacy())
  );
create policy "pharmacy_items update" on pharmacy_items
  for update using (
    clinic_id = auth_clinic_id() and (auth_is_admin() or auth_is_pharmacy())
  );

-- pharmacy_movements: mismo criterio de lectura amplia / escritura
-- restringida a admin o permiso de farmacia. Sin políticas de
-- update/delete — kardex inmutable (ver comentario en la tabla).
create policy "pharmacy_movements select" on pharmacy_movements
  for select using (clinic_id = auth_clinic_id());
create policy "pharmacy_movements insert" on pharmacy_movements
  for insert with check (
    clinic_id = auth_clinic_id() and (auth_is_admin() or auth_is_pharmacy())
  );

-- ------------------------------------------------------------
-- Storage: bucket para el logo del doctor (encabezado de receta impresa)
-- ------------------------------------------------------------

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

-- ============================================================
-- Nota: cuando crees el primer usuario admin de una clínica,
-- hazlo manualmente la primera vez:
-- 1. Crea el usuario en Authentication > Users (Supabase dashboard)
-- 2. Inserta una fila en `clinics`
-- 3. Inserta una fila en `users` con ese id + clinic_id + is_admin=true
--    (role puede quedar en null si no atiende pacientes directamente)
-- Después, ese admin puede crear más staff desde la app (/dashboard/usuarios).
-- ============================================================
