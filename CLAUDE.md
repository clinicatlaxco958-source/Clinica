# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClinicSaaS — sistema de agenda, pacientes y expediente clínico ligero
(consultas, signos vitales, recetas) para clínicas médicas/dentales.
Multi-tenant: cada clínica ve únicamente sus propios datos gracias a Row
Level Security (RLS) en Supabase. Fase actual: **piloto en producción**
con una clínica real ("Clínica Tlaxco"), repo ya en GitHub. Sin registro
público; las clínicas y el primer admin se crean manualmente vía SQL.

Ver [PROGRESS.md](PROGRESS.md) para el estado de avance y qué falta, y
[NEGOCIO.md](NEGOCIO.md) para el modelo de negocio, restricción de costos
($0/mes en piloto) y las decisiones de producto/permisos ya acordadas.

## Commands

```bash
npm install       # instalar dependencias
npm run dev        # servidor de desarrollo en http://localhost:3000
npm run build       # build de producción
npm run start       # sirve el build de producción
npm run lint        # next lint
```

No hay suite de tests configurada en este proyecto todavía.

## Setup local

**Proyecto Supabase nuevo (fresh install):**
1. `cp .env.example .env.local` y llenar con las credenciales del proyecto
   Supabase (`Settings > API`): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y `SUPABASE_SERVICE_ROLE_KEY` (esta
   última solo server-side, nunca `NEXT_PUBLIC_`).
2. Ejecutar [supabase/schema.sql](supabase/schema.sql) completo en el SQL
   Editor de Supabase — ya incluye TODO (tablas, RLS, y todo lo agregado
   por las migraciones 002-010). Un proyecto nuevo **no necesita correr
   los archivos de `supabase/migrations/`**, esos son solo para llevar el
   proyecto piloto ya existente al día incrementalmente.
3. Crear la primera clínica y el usuario admin a mano (pasos en
   [README.md](README.md)); no hay flujo de registro en la app.

**Proyecto piloto ya existente:** si haces un cambio de schema, agrega un
archivo nuevo en `supabase/migrations/00N_descripcion.sql` (siguiente
número) Y refleja el mismo cambio en `supabase/schema.sql` (la versión
canónica para instalaciones nuevas). Los archivos de migración están
escritos para ser seguros de volver a correr (`if not exists` /
`drop ... if exists`).

## Architecture

**Stack**: Next.js 14 (App Router) + TypeScript, Supabase (Postgres + Auth
+ RLS), Tailwind CSS, `react-big-calendar` (calendario, MIT). Todas las
páginas de datos son Server Components que consultan Supabase directamente
con `await` — no hay capa de API REST intermedia ni gestor de estado en
cliente. Las partes interactivas (calendario, modales, formularios) son
Client Components que usan el cliente browser de Supabase directamente
(sin Server Actions, salvo `app/dashboard/usuarios/actions.ts`).

**Tres clientes Supabase distintos** ([lib/supabase](lib/supabase)):
- `lib/supabase/client.ts` — `createBrowserClient`, para Client Components
  (login, logout, y prácticamente toda la interacción de citas/pacientes/
  consultas — inserts/updates se hacen directo desde el cliente, protegidos
  por RLS, no por una API intermedia).
- `lib/supabase/server.ts` — `createServerClient` leyendo cookies de
  `next/headers`, para Server Components y layouts.
- `lib/supabase/admin.ts` — `createClient` de `@supabase/supabase-js` con
  la `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS). Uso **exclusivo
  server-side**, solo para operaciones de Auth Admin (crear/eliminar
  usuario, resetear contraseña) en
  [app/dashboard/usuarios/actions.ts](app/dashboard/usuarios/actions.ts) y
  para leer emails de `auth.users` en
  [app/dashboard/usuarios/page.tsx](app/dashboard/usuarios/page.tsx). Nunca
  importar este archivo desde un Client Component.

**Autenticación y autorización tienen dos capas**:
1. [middleware.ts](middleware.ts) — redirige a `/login` cualquier request a
   `/dashboard/*` sin sesión, y fuerza `/dashboard/cambiar-password` si el
   usuario tiene `user_metadata.must_change_password = true` (contraseña
   temporal sin cambiar, ver flujo de alta de usuario más abajo).
2. [app/dashboard/layout.tsx](app/dashboard/layout.tsx) — vuelve a
   verificar el usuario server-side y hace un `select` a `users` (join con
   `clinics`) para el header; si el usuario fue suspendido (`active=false`)
   la fila ya no es visible por RLS, así que se cierra sesión y se
   redirige a login.

La seguridad real de aislamiento multi-tenant vive en **RLS**, no en el
código de la app. Funciones helper `security definer` en
[supabase/schema.sql](supabase/schema.sql):
- `auth_clinic_id()` — clinic_id del usuario autenticado, o `null` si está
  suspendido (`active=false`) — esto por sí solo bloquea TODO acceso RLS
  para un usuario suspendido, no solo el login.
- `auth_is_admin()` — si el usuario tiene el permiso `is_admin` (ver
  modelo de datos).
- `auth_doctor_id()` — el `doctors.id` del usuario, o `null` si no es
  doctor (recepción, admin sin función clínica).

**Regla de acceso clínico (importante, se repite en varias tablas):** un
doctor (no-admin) solo ve/edita **sus propias** citas, consultas y
recetas — la condición típica en las políticas es
`auth_is_admin() or auth_doctor_id() is null or doctor_id = auth_doctor_id()`
(el `is null` cubre a recepción/staff sin función clínica, que ve todo).
Para `prescription_items`, la política de **escritura** es más estricta
(`auth_is_admin() or doctor_id = auth_doctor_id()`, sin el `is null`):
solo el doctor dueño de la cita (o admin) puede prescribir — recepción
puede *ver* la receta pero no escribirla. Cualquier query hecha con el
anon key ya viene filtrada automáticamente — no agregar
`.eq("clinic_id", ...)` ni checks de doctor manualmente en el código de
la app, eso ya lo hace RLS.

**Modelo de datos** ([supabase/schema.sql](supabase/schema.sql)):
- `clinics` → `users` (staff, 1:1 con `auth.users`; `role` en
  `doctor`/`receptionist`/`null`, **independiente** de `is_admin` — una
  misma persona puede ser doctor y admin a la vez) → `doctors` (perfil
  extendido si el user es doctor: `specialty`, `default_duration_minutes`,
  `work_start_time`/`work_end_time`, con defaults a nivel `clinics` si el
  doctor no los define).
- `patients` — `full_name` es una columna **generada** a partir de
  `first_name`/`last_name_paternal`/`last_name_maternal`; hay columnas
  `*_search` generadas (minúsculas, sin acentos vía `immutable_unaccent`)
  para búsqueda/detección de duplicados que no distinga "José" de "Jose".
- `appointments` — cita con `status` (pendiente/confirmada/completada/
  cancelada/no_show) y `payment_status`.
- `consultations` — 1:1 con `appointments` (signos vitales + notas de
  consulta). Cualquiera con acceso a la cita puede escribir (incluye
  recepción, para signos vitales), pero el código de la app solo manda el
  campo `notes` cuando quien guarda es el doctor dueño de la cita — así
  nunca se sobrescriben las notas clínicas desde la pantalla de "Signos
  vitales" (ver `canEditNotes` en `ConsultationForm.tsx`).
- `prescription_items` — 1:muchos con `appointments` (un renglón por
  medicamento: nombre, `presentation` — tableta/cápsula/jarabe/gotas/
  inyección/crema/otro —, `quantity`, `custom_instruction` para "otro",
  `frequency_hours`, `duration_days`). Solo escribible por el doctor dueño
  o admin (ver regla de acceso arriba).

**Rutas de la app** ([app/](app)):
- `/` redirige según sesión a `/dashboard/citas` o `/login`.
- `/dashboard/citas` — agenda/calendario (`AgendaCalendar.tsx`, usa
  `react-big-calendar`). Vistas día (default, hoy)/semana/mes. La
  cuadrícula de horarios se alinea a la duración/jornada del doctor
  filtrado (`step`/`min`/`max` calculados en `gridConfig`). Un doctor
  no-admin no ve el selector "Todos los doctores" (`canViewAllDoctors`),
  solo su propia agenda. Clic en hueco vacío abre `NewAppointmentModal`
  (crear cita); clic en una cita abre `AppointmentDetailModal` (cambiar
  estado con un clic en el badge, reasignar doctor si tienes permiso, y
  botón final "Iniciar consulta" o "Capturar signos vitales" según si la
  cita es tuya).
  - `/dashboard/citas/[id]/consulta` — pantalla de consulta/signos
    vitales de una cita específica (`ConsultationForm.tsx`): signos
    vitales siempre editables; notas de consulta y sección "Tratamiento"
    (medicamentos dinámicos, con vista previa de receta en vivo a la
    derecha) solo si `canEditNotes` (eres el doctor de esa cita).
- `/dashboard/pacientes` — lista + buscador (sin acentos) de pacientes
  (`PatientsTable.tsx`); clic en un nombre abre `PatientHistoryModal`
  (componente compartido en [components/](components)) con su historial
  de consultas — un doctor solo ve las consultas que él tuvo con ese
  paciente (RLS), admin/recepción ven todo.
- `/dashboard/usuarios` — admin-only (`is_admin`), gestión de staff:
  crear (modal, contraseña temporal mostrada una vez, fuerza cambio en
  primer login), suspender/reactivar, eliminar, resetear contraseña. Usa
  `lib/supabase/admin.ts` vía Server Actions.
- `/dashboard/perfil` — datos de perfil (solo lectura) + si eres doctor,
  formulario para editar tu especialidad/duración/jornada
  (`DoctorSettingsForm.tsx`).
- `/dashboard/cambiar-password` — pantalla obligatoria (modal, sin botón
  de cerrar) cuando `must_change_password` está activo.

**Loading states**: cada ruta de `/dashboard/*` tiene su `loading.tsx`
(skeleton con `animate-pulse`) — Next.js lo muestra automáticamente
durante la navegación mientras el Server Component resuelve sus queries.
Sin esto, cambiar de página se sentía como que el clic no había hecho
nada.

**Estilo**: Tailwind con color `brand` custom
([tailwind.config.ts](tailwind.config.ts)). Paleta de estados de cita
(`statusColors`/`statusLabels`) se repite en varios archivos (agenda,
detalle de cita) — están duplicadas a propósito por simplicidad, no hay
un archivo central de constantes todavía.

**Patrón de UI recurrente**: varios componentes usan un popover/menú que
se cierra con clic-afuera vía `useRef` + listener de `mousedown` en
`document` (ver `DashboardHeader.tsx`, el selector de estado en
`AppointmentDetailModal.tsx`, el buscador de pacientes en
`NewAppointmentModal.tsx`). Y varios flujos de "¿estás seguro / esto ya
existe?" usan el mismo patrón de aviso con opción de continuar en vez de
bloquear (paciente duplicado, cita encimada) — antes de agregar un nuevo
flujo de confirmación, revisa si este patrón ya aplica.

## Git

Repo en GitHub: `https://github.com/clinicatlaxco958-source/Clinica.git`
(remoto `origin`, rama `main`). `.env.local` está en `.gitignore` — nunca
se sube.
