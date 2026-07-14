# Progreso — ClinicSaaS

Bitácora de avance del proyecto. Actualizar al final de cada sesión de
trabajo para que cualquier agente (o Tony) pueda retomar sin releer todo
el código.

## Estado actual (2026-07-11)

- Código fuente descomprimido desde `clinicsaas.zip` a esta carpeta
  (`Documents/Personal/clinica`).
- `npm install` corrido con éxito (117 paquetes).
- `CLAUDE.md` y `NEGOCIO.md` creados con la arquitectura y el modelo de
  negocio del proyecto.
- Proyecto de Supabase creado (piloto). `supabase/schema.sql` ejecutado
  sin errores.
- `.env.local` creado con `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` reales (archivo ignorado por git).
- Clínica piloto **"Clínica Tlaxco"** (tipo `medica`, tel. 2411842276)
  creada en la tabla `clinics`.
- Usuario admin **Jose Antonio Blancas** creado en Supabase Auth
  (uuid `45387892-1fc5-4a0b-ae26-70d5ddc88ba9`) y vinculado en la tabla
  `users` con `role = 'admin'` a la clínica anterior.

**Desde entonces (ver historial abajo) ya se construyó:** gestión de
usuarios (`/dashboard/usuarios`, admin-only), cambio de contraseña
obligatorio en primer login, un shell nuevo con header superior + menú
de perfil, un calendario real (día/semana/mes) en la agenda, y el
formulario de "+ Nueva cita" (con alta rápida de paciente). Detalle
completo en el historial de sesiones.

## Próximos pasos inmediatos

1. Horario semanal recurrente por doctor (`NEGOCIO.md` sección 11) —
   falta modelar (tabla nueva de bloques día/hora) y construir la UI,
   editable por el doctor desde su perfil o por el admin. "Nueva cita"
   hoy no valida contra un horario (solo evita encimes con otras citas).
2. "+ Nuevo paciente" como pantalla propia en `/dashboard/pacientes`
   (hoy solo se puede crear un paciente desde dentro del modal de
   "Nueva cita", no hay alta independiente).
3. Probar el flujo completo de "Nueva cita" end-to-end con datos reales.

## Conocido / pendiente de resolver

- **Next.js 14.2.5 tiene una vulnerabilidad de seguridad crítica**
  reportada por `npm install` (ver
  https://nextjs.org/blog/security-update-2025-12-11). No se ha
  actualizado todavía — decidir si se sube de versión antes o después de
  conectar Supabase.
- El botón "+ Nuevo paciente" de `/dashboard/pacientes` sigue sin
  funcionalidad (la única forma de crear un paciente hoy es desde dentro
  del modal de "Nueva cita").
- La validación de encime de horarios en "Nueva cita" se hace a nivel de
  app (consulta antes de insertar), no con un constraint de base de
  datos — con el volumen de una clínica piloto el riesgo de condición de
  carrera es despreciable, pero es una limitación conocida si el
  volumen crece.
- No hay tests configurados.
- `/dashboard/perfil` es un stub de solo lectura (nombre, correo,
  clínica, función, permisos) — no tiene todavía cambio de contraseña
  voluntario ni edición de nombre.

## Decisiones de diseño pendientes de implementar

- **Gestión de usuarios** (ver `NEGOCIO.md` sección 8) — **implementado**
  el 2026-07-11/12: solo admins gestionan staff de su clínica
  (crear/suspender/eliminar/reset password vía `/dashboard/usuarios`);
  "admin" es un permiso (`is_admin` booleano) separado de la función
  clínica (`role`: doctor/receptionist). Sin registro público — login
  solo tiene "solicita una demo" (pendiente: ese link/formulario en sí
  todavía no existe en el login).
- **Planes y límites de usuarios** (ver `NEGOCIO.md` sección 9): 3 planes
  (Básico ≤4 doctores, Intermedio 5–10, Plus 11+) basados en # de
  doctores, no en staff total. Staff no-doctor con tope dinámico de 3× el
  # de doctores; al llegar al tope la app debe sugerir upgrade/add-on en
  vez de bloquear. Falta definir precios en MXN y el tope superior exacto
  del plan Plus. **No implementado en código todavía** (no hay tabla de
  planes ni enforcement del límite).
- **Agenda / calendario** (ver `NEGOCIO.md` sección 10) —
  **implementado** el 2026-07-12: filtro de doctor dentro de la misma
  vista, un solo home (`/dashboard/citas`) con default inteligente del
  filtro según el rol (doctor → "yo", admin/recepción → "todos"), vistas
  día (default, hoy)/semana/mes con navegación, usando `react-big-calendar`
  (MIT, gratis).
- **Duración de consulta y horario del doctor** (ver `NEGOCIO.md` sección
  11): duración estimada por doctor como campo opcional en el alta de
  usuario — **implementado** el 2026-07-12 (`clinics.default_appointment_duration_minutes`
  default 30, `doctors.default_duration_minutes` opcional, campo en el
  formulario de "Nuevo usuario" cuando el rol es doctor). **Pendiente:**
  el horario semanal recurrente en sí (no construido todavía — sin eso,
  "+ Nueva cita" no puede sugerir huecos válidos), editable por el propio
  doctor desde su perfil o por el admin. Alcance inicial simple: sin
  excepciones ni tipos de consulta con duración distinta.

## Fase 2 (sugerido en el README original, no iniciado)

- Recordatorios automáticos (email vía Resend, o WhatsApp Business Cloud
  API).
- Reportes: citas por mes, tasa de no-shows, ingresos.

## Historial de sesiones

- **2026-07-11**: Descompresión del zip, `npm install`, documentación
  inicial (`CLAUDE.md`, este archivo). Aún no se ha creado el proyecto de
  Supabase.
- **2026-07-11**: Se agregó `NEGOCIO.md` con el modelo de negocio
  (renta mensual por clínica, niveles por # de doctores), la restricción
  de costo $0/mes en fase piloto, y la nota legal sobre datos de salud
  como "datos sensibles" bajo la LFPDPPP (México) — requiere aviso de
  privacidad, ya cubierto en parte por RLS.
- **2026-07-11**: Proyecto de Supabase creado y conectado (`.env.local`,
  schema ejecutado, clínica piloto "Clínica Tlaxco" + usuario admin Jose
  Antonio Blancas creados). Login probado y funcionando.
- **2026-07-11/12**: Definidas y documentadas en `NEGOCIO.md` las reglas
  de negocio de gestión de usuarios (sección 8) y planes/precios (sección
  9). Implementada la gestión de usuarios en código: migración SQL
  (`supabase/migrations/002_admin_permission.sql`, agrega `is_admin` y
  `active` a `users`, políticas RLS admin-only), cliente admin
  server-side (`lib/supabase/admin.ts`, usa `SUPABASE_SERVICE_ROLE_KEY`),
  vista `/dashboard/usuarios` con crear (modal, contraseña temporal
  mostrada una vez)/suspender/reactivar/eliminar/resetear contraseña.
  Agregado cambio de contraseña obligatorio en primer login
  (`/dashboard/cambiar-password`, bandera `must_change_password` en
  metadata, forzado vía `middleware.ts`) con toggle de mostrar/ocultar
  contraseña. Rediseñado el shell del dashboard: header superior nuevo
  (`components/DashboardHeader.tsx`) con menú de perfil/cerrar sesión,
  sidebar (`components/DashboardNav.tsx`) simplificado a solo links, y
  stub de `/dashboard/perfil`.
- **2026-07-12**: Discusión y documentación (sin código) de cómo debe
  funcionar la agenda/calendario — filtro de doctor, home único con
  default inteligente por rol (`NEGOCIO.md` sección 10).
- **2026-07-12**: Confirmado que `react-big-calendar` es gratuito
  (licencia MIT, sin tiers de pago). Implementado el calendario de
  `/dashboard/citas` (`AgendaCalendar.tsx`) con vistas día/semana/mes,
  filtro de doctor, y colores por estado de cita. De paso se corrigió un
  bug preexistente (no relacionado) en `lib/supabase/server.ts` y
  `middleware.ts` que rompía `npm run build` por tipos implícitos `any`.
- **2026-07-12**: Definida (sin código) la forma de manejar duración de
  consulta y horario del doctor — campo de duración opcional en el alta
  de usuario, horario semanal editable aparte por el doctor o el admin
  (`NEGOCIO.md` sección 11).
- **2026-07-12**: Implementada la duración de consulta: migración SQL
  (`supabase/migrations/003_doctor_duration.sql`, agrega
  `clinics.default_appointment_duration_minutes` y
  `doctors.default_duration_minutes`), campo "Duración de consulta"
  agregado al formulario de "Nuevo usuario" cuando el rol es doctor.
  Horario semanal queda pendiente para una sesión futura.
- **2026-07-12**: Implementado el formulario de "+ Nueva cita"
  (`app/dashboard/citas/NewAppointmentModal.tsx`): buscador de pacientes
  con alta rápida inline, selector de doctor con duración
  auto-calculada (propia o default de la clínica, editable), validación
  de encime de horario antes de guardar, y clic en un hueco vacío del
  calendario (día/semana) para precargar fecha/hora. El calendario se
  refresca solo tras crear la cita.
