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

**Cumplimiento normativo (dato de salud, no es opcional).** El proyecto
maneja expediente clínico real y está sujeto a NOM-004-SSA3-2012
(contenido de la historia clínica), NOM-024-SSA3-2012 (requisitos del
sistema: auditoría, integridad, conservación) y LFPDPPP (datos de salud
como datos sensibles) — ver [NEGOCIO.md](NEGOCIO.md) sección 13 para el
detalle y el alcance de cumplimiento ya decidido. **Si un requerimiento
de producto que te pidan entra en conflicto con alguna de estas normas,
señálalo explícitamente antes de implementarlo** — no lo implementes
asumiendo que está bien, y no te niegues sin explicar el conflicto
concreto y ofrecer una alternativa que sí cumpla.

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
  doctor (recepción, enfermería, admin sin función clínica).
- `auth_is_nurse()` — si el usuario tiene `role = 'nurse'` (enfermería).

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
  `doctor`/`receptionist`/`nurse`/`null`, **independiente** de `is_admin`
  — una misma persona puede ser doctor y admin a la vez) → `doctors`
  (perfil extendido si el user es doctor: `specialty` — catálogo
  controlado, no texto libre, ver [lib/specialties.ts](lib/specialties.ts)
  y migración 020: cada especialidad declara un "área" (`medica`/
  `dental`) que decide qué bloque de `medical_histories` exigir en cada
  cita, ver abajo —, `default_duration_minutes`, `work_start_time`/
  `work_end_time`, con defaults a nivel `clinics` si el doctor no los
  define). `nurse`
  (migración 018, helper `auth_is_nurse()`) puede capturar el
  interrogatorio/antecedentes de `medical_histories` (para llenarlo en
  el lobby antes de la consulta, ver NEGOCIO.md sección 13), pero nunca
  el juicio clínico (exploración/diagnóstico/tratamiento) — eso sigue
  exclusivo de doctor/admin sin importar el rol, blindado con un trigger
  en base de datos, no solo con RLS/UI (ver `medical_histories` abajo).
- `patients` — `full_name` es una columna **generada** a partir de
  `first_name`/`last_name_paternal`/`last_name_maternal`; hay columnas
  `*_search` generadas (minúsculas, sin acentos vía `immutable_unaccent`)
  para búsqueda/detección de duplicados que no distinga "José" de "Jose".
  Ficha de identificación NOM-004 (migración 016): `sex`, `curp`,
  `address`, `occupation`, `marital_status`, `blood_type`,
  `emergency_contact_name`, `emergency_contact_phone` — todas nullable a
  propósito (datos administrativos que se pueden completar en visitas
  posteriores, ver NEGOCIO.md sección 13). `ethnic_group`/
  `ethnic_group_detail` (migración 023) son aparte: opcionales ("en su
  caso", NOM-004 6.1.1) y **nunca cuentan** para el aviso de "datos
  pendientes" — a diferencia del resto, nadie debe insistirle al
  paciente por un dato que es opcional por naturaleza. Editables desde
  `MedicalHistorySection.tsx` (ver más abajo).
- `medical_histories` — historia clínica (migración 017), **1:1 con
  `patient_id`** (no con `appointment_id`, a diferencia de
  `consultations`): antecedentes, exploración y diagnóstico son del
  paciente, no de una visita puntual. Núcleo común (antecedentes,
  alergias) siempre; el bloque médico o dental que se exige en el
  bloque "clínico" (ver abajo) se decide por el **área de la
  especialidad del doctor de esa cita en particular** (no por
  `clinics.type`, que ya no se usa para esto — se dejó la columna sin
  borrar por si sirve para otra cosa, ver NEGOCIO.md sección 13; "primera
  visita" es por especialidad: compartida entre doctores de la misma
  área, mas no entre áreas distintas). Todo nullable a nivel de BD — la
  obligatoriedad de llenarlo en la primera consulta se valida en la app
  (`MedicalHistorySection.tsx`), no con `NOT NULL`, para poder ampliarlo
  después sin bloquear. **RLS distinta a `consultations`:** cualquier
  doctor de la clínica (no solo el dueño de la cita), admin, o enfermería
  puede ver/editar la historia clínica de cualquier paciente —el
  propósito de NOM-004 es continuidad de atención entre doctores, no un
  cuaderno privado por doctor. Recepción no tiene acceso en absoluto.
  Columnas divididas en dos bloques con dueño distinto (ver
  `MedicalHistorySection.tsx`): "intake" (`heredo_familiares`,
  `personales_no_patologicos`, `personales_patologicos`, `tobacco_use`/
  `tobacco_detail`, `alcohol_use`/`alcohol_detail`,
  `other_substances_use`/`other_substances_detail` — checks booleanos,
  migración 021, ubicados dentro de "personales patológicos" según
  NOM-004 numeral 6.1.1, no son campo obligatorio porque un checkbox
  siempre tiene respuesta válida —, `allergies`, `present_illness`,
  `systems_review`, `previous_studies`, `dental_history`) editable por
  enfermería/doctor/admin; "clínico"
  (`physical_exam`, `diagnosis`, `prognosis`, `treatment_plan`,
  `oral_exam`, `dental_diagnosis`, `dental_treatment_plan`, `odontogram`)
  **exclusivo de doctor/admin, blindado con el trigger
  `medical_histories_restrict_clinical_fields`** (migración 018) —
  rechaza el `INSERT`/`UPDATE` si alguien sin rol de doctor/admin toca
  esas columnas, incluso saltándose la UI. Es más estricto a propósito
  que el resto del proyecto (`consultations.notes` solo confía en que la
  app no mande el campo) porque aquí el límite es "quién puede
  diagnosticar", no solo una nota clínica. `intake_by`/`intake_at` y
  `clinical_by`/`clinical_at` guardan quién capturó cada bloque
  (trazabilidad mínima de autoría). Sin política de `delete` a propósito
  (un expediente no se borra).
- `clinical_audit_log` — auditoría de cambios (migración 019, Fase 3):
  antes de cada `UPDATE` en `consultations` o `medical_histories`, el
  trigger `log_clinical_audit()` (`security definer`, corre pase lo que
  pase con los permisos de quien guarda) copia la fila **completa como
  estaba antes** (`to_jsonb(old)`) a esta tabla. Es un archivo histórico,
  no una pantalla de uso diario: solo `auth_is_admin()` puede leerlo, y
  nadie tiene permiso directo de insert/update/delete (mismo patrón que
  el kardex inmutable de `pharmacy_movements`) — solo escribe el trigger.
  No hay todavía una pantalla para navegar el historial de versiones
  (dato capturado y seguro, pero sin UI de "ver cómo estaba antes"); si
  se pide, es la tabla de la que hay que leer.
- `appointments` — cita con `status` (pendiente/confirmada/completada/
  cancelada/no_show) y `payment_status`.
- `consultations` — 1:1 con `appointments` (signos vitales + notas de
  consulta). Cualquiera con acceso a la cita puede escribir (incluye
  recepción, para signos vitales), pero el código de la app solo manda el
  campo `notes` cuando quien guarda es el doctor dueño de la cita — así
  nunca se sobrescriben las notas clínicas desde la pantalla de "Signos
  vitales" (ver `canEditNotes` en `ConsultationForm.tsx`). `updated_by`
  (migración 019) registra quién guardó por última vez; se muestra como
  "Última edición: fecha por nombre" en `ConsultationForm.tsx`.
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
  - `/dashboard/citas/[id]/consulta` — pantalla de consulta de una cita
    específica. `page.tsx` (Server Component) resuelve todos los datos
    y el "área" del doctor (ver modelo de datos) y se los pasa a
    `ConsultaClient.tsx`, que renderiza `PatientInfoCard.tsx` +
    `MedicalHistorySection.tsx` + `PatientVisitsPanel.tsx` +
    `ConsultationForm.tsx` y coordina el estado que comparten: qué modal
    está abierto y en qué modo, si la historia clínica ya está completa,
    y cuántos datos de identificación faltan.
    - `PatientInfoCard.tsx` — el **banner del paciente, hub de todos los
      accesos**: "Consultas anteriores" (abre `PatientVisitsPanel.tsx`),
      "Antecedentes" y "Exploración y diagnóstico" (cada uno con acciones
      **Ver**/**Editar** independientes si ya están completos, o un
      solo botón "Completar" si no), y la ficha de identificación
      pendiente (botón ámbar con el conteo si falta algo, neutro si no).
      Es puramente presentacional — no tiene estado propio, solo
      dispara los callbacks que `ConsultaClient.tsx` coordina.
    - `MedicalHistorySection.tsx` (historia clínica NOM-004) — ya **no
      dibuja tarjeta ni botones propios**, solo los tres modales
      (antecedentes / exploración y diagnóstico / ficha de
      identificación), controlados 100% desde afuera vía props
      (`intakeMode`/`clinicalMode`: `"closed"|"view"|"edit"`,
      `identificationOpen`). En modo `"view"` los campos se ven
      **deshabilitados** (mismo textarea/checkbox, con `disabled`, no
      texto plano) — con un botón "Editar" dentro del propio modal para
      pasar a `"edit"` sin cerrarlo, visible solo si esa persona tiene
      permiso de edición (`canEditIntake`/`canEditClinical`). Reporta
      hacia arriba `onCompletenessChange` (para el candado de "Terminar
      consulta" en `ConsultationForm.tsx`, ver abajo) y
      `onPendingIdentificationChange` (para el botón de datos pendientes
      en `PatientInfoCard.tsx`). Enfermería viendo el bloque clínico
      (que no puede editar) es simplemente `clinicalMode="view"` sin
      permiso de edición — mismo código, sin botón "Editar". **Se abre
      solo al entrar a la pantalla**: un `useEffect` que corre una vez
      al montar pone en `"edit"` cada bloque (antecedentes/exploración/
      ficha de identificación) que le falte a quien está viendo la
      pantalla en ese momento — si más de uno está incompleto a la vez,
      los modales quedan apilados (cada uno es su propio overlay) y se
      van cerrando uno a uno, revelando el siguiente debajo. Si sigue
      incompleto, se vuelve a abrir en la próxima visita (a propósito).
    - `PatientVisitsPanel.tsx` — side panel de "consultas anteriores"
      **específico de esta pantalla** (no reemplaza `PatientHistoryModal`,
      que sigue siendo el modal centrado usado en `/dashboard/pacientes`
      — decisión explícita de no unificarlos). Dos paneles apilados
      desde la derecha, cada uno 1/3 de la pantalla: la lista de citas
      pasadas, y — al seleccionar una — un segundo panel **encima**
      con el detalle de solo lectura (signos vitales, notas/padecimiento,
      y tratamiento vía `formatDose()` de `lib/prescription.ts`, que
      antes no se mostraba en el historial). "← Regresar" cierra solo el
      segundo panel; clic en el fondo oscurecido cierra ambos. Ambos
      paneles se deslizan al entrar/salir (`useSlideState`, un hook
      chico dentro del mismo archivo: mantiene el panel montado
      `TRANSITION_MS` de más al cerrar para que la transición de salida
      se alcance a ver, en vez de desaparecer de golpe).
    - `ConsultationForm.tsx`: signos vitales siempre editables; notas
      de consulta y sección "Tratamiento" (medicamentos dinámicos, con
      vista previa de receta en vivo a la derecha) solo si
      `canEditNotes` (eres el doctor de esa cita). El botón "Terminar
      consulta" se **bloquea** si `historyComplete` es falso (le falta
      historia clínica obligatoria) — muestra el error y llama a
      `onIncompleteHistory`, que en `ConsultaClient.tsx` pone
      `intakeMode`/`clinicalMode` en `"edit"` directamente (ya no hay
      truco de contador tipo `forceOpenSignal`, el modo del modal vive
      en el padre que también controla el botón).
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
- `/aviso-de-privacidad` — **pública**, fuera de `/dashboard` (el
  matcher de `middleware.ts` es solo `/dashboard/:path*`, así que no
  pide sesión). Borrador del aviso de privacidad LFPDPPP — contenido
  estático (no lee `clinics`, esa tabla tiene RLS que requiere sesión de
  todos modos), con los datos propios de cada clínica marcados en
  amarillo (`Placeholder` en el mismo archivo) para que el Doctor los
  confirme/complete antes de publicarlo como oficial. Linkeado desde
  `/login`. Ver NEGOCIO.md sección 13 — falta todavía la captura de
  consentimiento expreso por paciente (checkbox + fecha), esto es solo
  el texto/la página.

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
