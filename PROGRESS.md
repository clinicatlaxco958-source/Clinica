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
  respeta la misma regla de "un doctor solo ve lo suyo". Botón
  "+ Nuevo paciente" (`NewPatientButton.tsx` + `NewPatientModal.tsx`)
  para alta suelta, sin pasar por "Nueva cita" — reutiliza el mismo
  patrón de búsqueda en vivo + detección de duplicados que ya existía
  en `NewAppointmentModal.tsx` (antes el botón estaba ahí pero sin
  `onClick`, no hacía nada).
- **Duplicados de paciente**: nombre dividido en Nombre(s)/Apellido
  paterno/materno + fecha de nacimiento obligatoria; si coincide con uno
  existente, pregunta "¿es la misma persona?" en vez de bloquear o crear
  ciego.
- **Receta imprimible**, embebida directo en
  `/dashboard/citas/[id]/consulta` (no es una ruta aparte — se eliminó
  la ruta `/receta` que existía antes; ver "Historial de sesiones"
  2026-07-18 para el porqué): formato tipo receta médica real — header
  con logo del doctor (subido desde `/dashboard/perfil` vía Supabase
  Storage, bucket `doctor-logos`), universidad y cédula profesional;
  franja izquierda con fecha de hoy, signos vitales y dirección/
  contacto de la clínica; cuerpo con paciente/edad, medicamentos y
  espacio de firma abajo a la derecha. Marca de agua opcional (mismo
  mecanismo de subida que el logo, `doctors.watermark_url`, migración
  012) de fondo semitransparente. La vista previa (dentro de
  `ConsultationForm`) refleja los signos vitales y medicamentos **en
  vivo** mientras el doctor los captura, sin esperar a guardar. Ícono
  de impresora junto al título "Receta" (solo visible para el doctor
  dueño de la cita) dispara `window.print()`; CSS `print:` de Tailwind
  oculta todo lo demás de la página (header/nav del dashboard,
  formulario de signos vitales, tarjeta de paciente) para que solo se
  imprima la hoja de la receta.

### Esquema de base de datos

`supabase/schema.sql` es la versión canónica completa (para un proyecto
Supabase nuevo, correr solo este archivo). `supabase/migrations/002` a
`010` son los incrementales ya aplicados al proyecto piloto existente —
no hace falta correrlos en una instalación nueva. Tablas: `clinics`,
`users`, `doctors`, `patients`, `appointments`, `consultations`,
`prescription_items`.

## Próximos pasos / pendientes conocidos

1. **Horario semanal con variación por día/excepciones** — hoy la
   jornada del doctor es un solo horario fijo (inicio/fin), sin
   diferenciar días de la semana ni vacaciones/días festivos. Alcance
   actual es intencionalmente simple (ver `NEGOCIO.md` sección 11).
2. **Planes y límites de usuarios** (`NEGOCIO.md` sección 9): 3 niveles
   definidos (Básico ≤4 doctores, Intermedio 5–10, Plus 11+) con tope
   dinámico de staff no-doctor (3× # doctores) — **no implementado en
   código**, no hay tabla de planes ni enforcement del límite, ni
   precios definidos en MXN.
3. **Catálogo de medicamentos** — se investigó (sin implementar); no
   existe una API pública gratuita en México, la opción más realista es
   extraer el Cuadro Básico (PDF oficial) una sola vez a una tabla propia.
4. **Reportes** (citas por mes, tasa de no-shows, ingresos) y
   **recordatorios automáticos** (email/WhatsApp) — fase 2, no iniciado.
4b. **Verificación real de teléfono (OTP)** — el login/alta de staff por
   teléfono (`lib/phone.ts`) valida solo formato (10 dígitos MX), el
   número se marca `phone_confirm: true` sin enviarlo por SMS/WhatsApp.
   Pendiente configurar un proveedor (Twilio u otro) en Supabase Auth
   cuando haya presupuesto — en ese momento este flag pasa a depender de
   la verificación real.
5. **Next.js 14.2.5 tiene una vulnerabilidad de seguridad conocida**
   (ver https://nextjs.org/blog/security-update-2025-12-11) — no
   actualizado todavía, decidir cuándo subir de versión.
6. **La validación de encime de horarios** se hace a nivel app (consulta
   antes de insertar), no con un constraint de base de datos — riesgo de
   condición de carrera despreciable al volumen actual, pero es una
   limitación conocida si crece mucho el volumen concurrente.
7. **Login sin "solicita una demo"** — está decidido que el login no
   debe tener registro público sino un link/formulario de contacto, pero
   ese link todavía no existe en `/login`.
8. No hay tests configurados.

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
- **2026-07-17**: Receta imprimible con formato real (migración 011):
  logo del doctor (subida a Supabase Storage, bucket `doctor-logos`
  nuevo con políticas RLS por carpeta de `auth.uid()`), universidad y
  cédula profesional configurables desde `/dashboard/perfil`. Nueva
  ruta `/dashboard/citas/[id]/receta` con el layout tipo receta médica
  real (header logo+universidad+nombre+cédula, franja izquierda con
  fecha/signos vitales/dirección, cuerpo con paciente/edad/medicamentos/
  firma) e impresión vía `window.print()` (sin PDF generado ni
  dependencias nuevas — CSS `print:` de Tailwind oculta el header/nav
  del dashboard). Lógica de formato de dosis (`PRESENTATIONS`/
  `formatDose`) extraída a `lib/prescription.ts` para compartirse entre
  la vista previa en vivo y la receta imprimible.
- **2026-07-18**: Marca de agua del doctor (migración 012,
  `watermark_url`, mismo bucket/mecanismo que el logo). Hoja de la
  receta homologada a tamaño carta (~816×1056px) en pantalla e
  impresión, `<title>` propio. Se probó y se descartó generar el PDF
  en cliente con `html2canvas`+`jspdf` (imagen rasterizada, no PDF de
  verdad, riesgo de CORS con las imágenes de Storage) — se revirtió a
  impresión nativa del navegador; si se necesita un PDF descargable de
  verdad más adelante, la vía correcta es Puppeteer/Playwright
  server-side. Después, por indicación explícita de Tony, se eliminó
  la ruta separada `/dashboard/citas/[id]/receta` y su layout se
  incrustó directo en la vista previa de `ConsultationForm` — ya no se
  navega a ninguna parte para imprimir, el botón de impresión vive en
  la misma pantalla de consulta y la vista previa ahora usa el estado
  en vivo del formulario (signos vitales y medicamentos) en vez de
  datos ya guardados en base de datos. Ajustes visuales de la receta
  (universidad/nombre centrados, logo sin marco, header con degradado
  gris, franja de signos vitales pegada a la fecha en vez de flotar a
  media hoja, padding de impresión reducido a casi cero) y corrección
  de un bug real: subir un logo/marca de agua nuevo con el mismo
  nombre de archivo no se reflejaba porque la URL pública no cambiaba
  (mismo path en Storage) y el navegador servía la imagen vieja
  cacheada — se resolvió agregando `?v=<timestamp>` a la URL guardada
  en cada subida.
- **Ajustes de impresión** (`PrintSettingsModal.tsx`, ícono de engrane
  junto al de imprimir en la vista de consulta): **imprimir copia**
  (agrega una segunda hoja idéntica, invisible en pantalla — solo
  aparece al imprimir vía `hidden print:flex`), **tamaño de receta**
  (hoja completa / media hoja, controla `print:min-h-screen` vs.
  `print:min-h-[50vh]`), y **footer de copia** (etiqueta "Copia
  paciente" en el original y "Copia doctor" en la copia — asunción a
  confirmar con Tony si el mapeo va al revés). Si se activan copia +
  media hoja, ambas caben en una sola hoja física con una línea
  punteada de corte entre ellas (`border-t-2 border-dashed`); si se
  activa copia sin media hoja, la copia sale en una hoja aparte
  (`break-before-page`). El layout de una hoja (header + cuerpo +
  footer) se extrajo a `PrescriptionSheet.tsx`, reutilizado para
  original y copia sin duplicar ~150 líneas de JSX.
- **2026-07-19**: Menú del header dice "Perfil" en vez de "Configuración
  de perfil". `/dashboard/perfil` (vista de doctor) rediseñada a 3 tabs
  en `DoctorSettingsForm.tsx` — Ajustes (especialidad/duración/horario),
  Receta (universidad/cédula/logo/marca de agua), Información (datos de
  solo lectura, antes vivían en `page.tsx`) — sin envolver todo en una
  tarjeta, a ancho completo como el resto de las páginas del dashboard
  (antes era un card angosto en `max-w-md`); un solo `handleSubmit`
  sigue guardando los campos de los 3 tabs sin importar cuál esté
  activo. Corregido el botón "+ Nuevo paciente" de `/dashboard/pacientes`
  que no tenía `onClick` (no hacía nada) — ahora abre
  `NewPatientModal.tsx` (alta suelta de paciente, reutilizando el mismo
  patrón de búsqueda en vivo + detección de duplicados de
  `NewAppointmentModal.tsx`), disparado por `NewPatientButton.tsx`.
- **2026-07-21**: Login e inicio de sesión de staff por **teléfono**
  (además de correo, no en reemplazo). Sin verificación real todavía
  (sin OTP por SMS/WhatsApp, ver "Próximos pasos" #4b) — solo se valida
  formato México (10 dígitos) en `lib/phone.ts`, y el usuario se crea en
  Supabase Auth con `phone_confirm: true` (se confía el número tal
  cual). Sigue siendo un admin quien da de alta la cuenta desde
  `/dashboard/usuarios` (no hay registro público, correo y teléfono son
  ambos opcionales pero se exige al menos uno); `CreateUserForm.tsx`
  ahora tiene campo de teléfono y la tabla de usuarios muestra ambos
  contactos. `/login` tiene pestañas Correo/Teléfono. No requirió
  cambios de schema — el teléfono vive en `auth.users` igual que el
  correo, no en `public.users`.
