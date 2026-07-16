# Progreso — ClinicSaaS

Bitácora de avance del proyecto. Actualizar al final de cada sesión de
trabajo para que cualquier agente (o Tony) pueda retomar sin releer todo
el código ni la conversación completa.

## Estado actual (2026-07-16)

**Piloto en producción real** con la clínica **"Clínica Tlaxco"** (tipo
`medica`). Repo en GitHub: `https://github.com/clinicatlaxco958-source/Clinica.git`.
Usuario admin: Jose Antonio Blancas.

### Implementado y funcionando

- **Auth y permisos**: login, logout, sesión protegida por middleware.
  "Admin" es un permiso (`is_admin`) independiente de la función clínica
  (`role`: doctor/receptionist/null) — una persona puede ser ambas cosas.
  Un doctor no-admin solo ve/gestiona **sus propias** citas, consultas y
  recetas (RLS, no solo UI); admin y recepción ven todo. Ver
  `CLAUDE.md` sección Architecture para el detalle de las políticas.
- **Gestión de usuarios** (`/dashboard/usuarios`, admin-only): crear
  (contraseña temporal mostrada una vez, fuerza cambio en primer login),
  suspender/reactivar, eliminar, resetear contraseña. Columna de correo
  visible (leído de `auth.users` vía cliente admin).
- **Perfil** (`/dashboard/perfil`): datos de solo lectura + si eres
  doctor, edita tu especialidad/duración de consulta/jornada
  (inicio-fin de horario).
- **Agenda/calendario** (`/dashboard/citas`): día (default)/semana/mes
  con `react-big-calendar`, cuadrícula alineada a la duración y jornada
  del doctor filtrado. Filtro de doctor oculto para doctores no-admin
  (solo ven "Mi agenda"). Loading states en toda la navegación del
  dashboard.
- **Crear cita** (clic en hueco vacío del calendario, no hay botón
  aparte): un solo formulario de paciente (buscador en vivo sin acentos
  vía popover al enfocar nombre/apellido, alta de paciente nueva sin
  botón "guardar" aparte — se resuelve/confirma al dar clic en "Crear
  cita"), selector de hora limitado a los horarios válidos del doctor
  (marca "(ocupado)" los ya tomados en vez de ocultarlos, con aviso de
  "¿agendar de todos modos?" si eliges uno ocupado).
- **Detalle de cita**: cambiar estado con un clic en el badge (menú de
  4 opciones); reasignar doctor (solo admin/recepción, útil para
  cubrir a un doctor ausente); botón final **"Iniciar consulta"** (si la
  cita es tuya) o **"Capturar signos vitales"** (si no) — cambia a
  "Modificar signos vitales" si ya se capturaron.
- **Consulta** (`/dashboard/citas/[id]/consulta`): signos vitales (peso,
  talla, temperatura, presión) editables por cualquiera con acceso a la
  cita; notas de consulta y **Tratamiento** (medicamentos dinámicos con
  presentación — tableta/cápsula/jarabe/gotas/inyección/crema/otro —,
  cantidad, frecuencia y días) solo si eres el doctor de la cita. Vista
  previa de receta en vivo al lado derecho.
- **Pacientes** (`/dashboard/pacientes`): lista + buscador sin acentos;
  clic en un nombre abre su historial de consultas (modal compartido
  `PatientHistoryModal`, también usado desde la pantalla de consulta) —
  respeta la misma regla de "un doctor solo ve lo suyo".
- **Duplicados de paciente**: nombre dividido en Nombre(s)/Apellido
  paterno/materno + fecha de nacimiento obligatoria; si coincide con uno
  existente, pregunta "¿es la misma persona?" en vez de bloquear o crear
  ciego.

### Esquema de base de datos

`supabase/schema.sql` es la versión canónica completa (para un proyecto
Supabase nuevo, correr solo este archivo). `supabase/migrations/002` a
`010` son los incrementales ya aplicados al proyecto piloto existente —
no hace falta correrlos en una instalación nueva. Tablas: `clinics`,
`users`, `doctors`, `patients`, `appointments`, `consultations`,
`prescription_items`.

## Próximos pasos / pendientes conocidos

1. **"+ Nuevo paciente" independiente** en `/dashboard/pacientes` — hoy
   solo se puede crear un paciente desde dentro del modal de "Nueva
   cita", no hay alta suelta.
2. **Horario semanal con variación por día/excepciones** — hoy la
   jornada del doctor es un solo horario fijo (inicio/fin), sin
   diferenciar días de la semana ni vacaciones/días festivos. Alcance
   actual es intencionalmente simple (ver `NEGOCIO.md` sección 11).
3. **Planes y límites de usuarios** (`NEGOCIO.md` sección 9): 3 niveles
   definidos (Básico ≤4 doctores, Intermedio 5–10, Plus 11+) con tope
   dinámico de staff no-doctor (3× # doctores) — **no implementado en
   código**, no hay tabla de planes ni enforcement del límite, ni
   precios definidos en MXN.
4. **Imprimir la receta** — hoy solo hay vista previa en pantalla, no
   hay botón de impresión ni PDF.
5. **Catálogo de medicamentos** — se investigó (sin implementar); no
   existe una API pública gratuita en México, la opción más realista es
   extraer el Cuadro Básico (PDF oficial) una sola vez a una tabla propia.
6. **Reportes** (citas por mes, tasa de no-shows, ingresos) y
   **recordatorios automáticos** (email/WhatsApp) — fase 2, no iniciado.
7. **Next.js 14.2.5 tiene una vulnerabilidad de seguridad conocida**
   (ver https://nextjs.org/blog/security-update-2025-12-11) — no
   actualizado todavía, decidir cuándo subir de versión.
8. **La validación de encime de horarios** se hace a nivel app (consulta
   antes de insertar), no con un constraint de base de datos — riesgo de
   condición de carrera despreciable al volumen actual, pero es una
   limitación conocida si crece mucho el volumen concurrente.
9. **Login sin "solicita una demo"** — está decidido que el login no
   debe tener registro público sino un link/formulario de contacto, pero
   ese link todavía no existe en `/login`.
10. No hay tests configurados.

## Historial de sesiones (resumen)

- **2026-07-11**: Setup inicial — descompresión del proyecto, `npm
  install`, conexión a Supabase (clínica piloto + admin creados),
  documentación base (`CLAUDE.md`, `NEGOCIO.md`, este archivo).
- **2026-07-11/12**: Gestión de usuarios completa (crear/suspender/
  eliminar/resetear, `is_admin` como permiso separado de `role`),
  cambio de contraseña obligatorio en primer login, shell nuevo
  (header + menú de perfil).
- **2026-07-12**: Calendario real con `react-big-calendar` (MIT,
  confirmado gratuito), duración de consulta por doctor, formulario de
  "Nueva cita" con alta de paciente, corrección de bug preexistente en
  `lib/supabase/server.ts`/`middleware.ts` (tipos implícitos `any`
  rompían `npm run build`).
- **2026-07-12/13**: Búsqueda sin acentos + detección de duplicados de
  paciente (nombre dividido en 3 campos + fecha de nacimiento
  obligatoria), horario de jornada por doctor (cuadrícula del calendario
  alineada a sus intervalos reales, selector de horas válidas en "Nueva
  cita"), loading states en toda la navegación, columna de correo en
  Usuarios, popover de pacientes existentes, aviso de "¿agendar de
  todos modos?" para horarios ocupados en vez de ocultarlos.
- **2026-07-13/14**: Un doctor no-admin restringido a ver/gestionar solo
  sus propias citas (RLS, migración 007) — incluye caso de "cubrir a un
  colega" resuelto con reasignación de doctor, no con excepción de
  permisos. Cambio de estado de cita con un clic en el badge. Módulo de
  **consultas**: signos vitales + notas (tabla `consultations`,
  migración 008), pantalla `/dashboard/citas/[id]/consulta` con acceso
  diferenciado doctor vs. recepción.
- **2026-07-14/15**: Módulo de **recetas**: medicamentos dinámicos
  (`prescription_items`, migración 009) con vista previa en vivo,
  presentación farmacéutica (tableta/cápsula/jarabe/gotas/inyección/
  crema/otro) para armar la frase de dosis correctamente (migración
  010). Historial de consultas por paciente (`PatientHistoryModal`,
  compartido entre Pacientes y Consulta). Investigación (sin código) de
  catálogos de medicamentos en México — sin API pública gratuita
  disponible.
- **2026-07-16**: Proyecto subido a GitHub (`clinicatlaxco958-source/Clinica`).
  Reescritura completa de `CLAUDE.md` y este archivo para reflejar todo
  lo construido — la versión anterior llevaba varias sesiones sin
  actualizarse mientras se avanzaba rápido en código.
