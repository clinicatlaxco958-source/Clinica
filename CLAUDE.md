# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClinicSaaS — sistema de agenda y pacientes para clínicas médicas/dentales.
Multi-tenant: cada clínica ve únicamente sus propios datos gracias a Row
Level Security (RLS) en Supabase. Fase actual: **piloto** (sin registro
público; las clínicas y el primer admin se crean manualmente vía SQL).

Ver [PROGRESS.md](PROGRESS.md) para el estado de avance y qué falta, y
[NEGOCIO.md](NEGOCIO.md) para el modelo de negocio, restricción de costos
($0/mes en piloto) y la nota legal sobre datos sensibles de salud en
México.

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

1. `cp .env.example .env.local` y llenar con las credenciales del proyecto
   Supabase (`Settings > API`): `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Ejecutar [supabase/schema.sql](supabase/schema.sql) completo en el SQL
   Editor de Supabase — crea tablas y políticas RLS en un solo paso.
3. Crear la primera clínica y el usuario admin a mano (pasos en
   [README.md](README.md)); no hay flujo de registro en la app.

## Architecture

**Stack**: Next.js 14 (App Router) + TypeScript, Supabase (Postgres + Auth
+ RLS), Tailwind CSS. Todas las páginas de datos son Server Components que
consultan Supabase directamente con `await` — no hay capa de API REST
intermedia ni gestor de estado en cliente.

**Dos clientes Supabase distintos** ([lib/supabase](lib/supabase)), y hay
que usar el correcto según el contexto:
- `lib/supabase/client.ts` — `createBrowserClient`, para Client Components
  (p. ej. [app/login/page.tsx](app/login/page.tsx), que hace
  `signInWithPassword`, y [components/DashboardNav.tsx](components/DashboardNav.tsx)
  para `signOut`).
- `lib/supabase/server.ts` — `createServerClient` leyendo cookies de
  `next/headers`, para Server Components y layouts (p. ej. las páginas de
  `dashboard/citas` y `dashboard/pacientes`).

**Autenticación y autorización tienen dos capas**:
1. [middleware.ts](middleware.ts) — redirige a `/login` cualquier request a
   `/dashboard/*` sin sesión (matcher `["/dashboard/:path*"]`). Este es un
   tercer cliente Supabase construido inline (no reutiliza los de `lib/`)
   porque el middleware corre en el edge runtime y necesita su propio
   manejo de cookies sobre `NextRequest`/`NextResponse`.
2. [app/dashboard/layout.tsx](app/dashboard/layout.tsx) — vuelve a
   verificar el usuario server-side, y además hace un `select` a la tabla
   `users` (join con `clinics`) para obtener `full_name`, `role` y el
   nombre de la clínica, que pasa a `DashboardNav`.

La seguridad real de aislamiento multi-tenant vive en **RLS**, no en el
código de la app: todas las tablas de negocio (`patients`, `appointments`,
`doctors`, `users`, `clinics`) tienen políticas que filtran por
`clinic_id = auth_clinic_id()`, donde `auth_clinic_id()` es una función SQL
`security definer` que resuelve la clínica del usuario autenticado
(`auth.uid()`) contra la tabla `users`. Cualquier query hecha con el anon
key ya viene filtrada por clínica automáticamente — no hace falta (ni se
debe) agregar `.eq("clinic_id", ...)` manualmente en el código de la app.

**Modelo de datos** ([supabase/schema.sql](supabase/schema.sql)):
`clinics` → `users` (staff, 1:1 con `auth.users`, `role` en
admin/doctor/receptionist) → `doctors` (perfil extendido si el user es
doctor, con `specialty`) → `patients` y `appointments` (citas con `status`
y `payment_status` como enums vía `check`). Todo cuelga de `clinic_id`.

**Rutas de la app** ([app/](app)): `/` redirige según sesión a
`/dashboard/citas` o `/login`. `/dashboard/citas` es la agenda del día
(filtra `appointments` por la fecha de hoy). `/dashboard/pacientes` lista
pacientes. Ambas son solo de lectura por ahora — los botones "+ Nueva
cita" / "+ Nuevo paciente" no tienen handler todavía (ver PROGRESS.md).

**Estilo**: Tailwind con color `brand` custom
([tailwind.config.ts](tailwind.config.ts)); paleta de estados de cita
(`statusColors`/`statusLabels`) definida inline en
[app/dashboard/citas/page.tsx](app/dashboard/citas/page.tsx).
