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

## Historia clínica / cumplimiento NOM-004 y NOM-024 (en curso)

Ver `NEGOCIO.md` sección 13 para el plan completo acordado con Tony (y
pendiente de mostrarle al Doctor). Fases: 1) ficha de identificación en
`patients` — **hecho** (migración 016); 2) tabla `medical_histories` +
pantallas — **hecho** (migraciones 017 y 018, ver detalle abajo); 3)
auditoría de cambios — **hecho** (migración 019, ver detalle abajo,
aunque sin pantalla para navegar el historial); 4) consentimiento
informado — **pendiente**.

**Fase 2 implementada (migración 017):** tabla `medical_histories` (1
fila por paciente, no por cita); componente `MedicalHistorySection.tsx`
en `/dashboard/citas/[id]/consulta`; sección de "datos pendientes de
identificación" (campos de la migración 016) visible/editable para
cualquier staff con acceso a la cita, incluida recepción — se recalcula
en cada carga y sigue apareciendo hasta completarse. Odontograma como
campo de texto libre opcional (no bloquea guardar), pendiente de un
componente visual si se necesita.

**Rol de enfermería (migración 018):** a petición del Doctor (quiere que
el interrogatorio/antecedentes de la primera visita se capturen en el
lobby antes de la consulta, sin quitarle tiempo al doctor), se agregó el
rol `nurse` ("Enfermería"), separado de `receptionist`. La historia
clínica se dividió en dos bloques con dueño distinto:
- **Interrogatorio/antecedentes** (heredo-familiares, personales
  patológicos/no patológicos, alergias, padecimiento actual,
  interrogatorio por aparatos y sistemas, estudios previos, antecedentes
  odontológicos) — editable por enfermería, doctor o admin, con su
  propio botón "Guardar antecedentes".
- **Juicio clínico** (exploración física, diagnóstico, pronóstico, plan
  de tratamiento, exploración bucal, diagnóstico/plan de tratamiento
  dental, odontograma) — **exclusivo de doctor/admin sin importar el
  rol**, con su propio botón "Guardar exploración y diagnóstico".
  Enfermería puede *ver* este bloque (continuidad de cuidados) pero no
  editarlo. Blindado con un **trigger en base de datos**
  (`medical_histories_restrict_clinical_fields`), no solo con RLS/UI —
  a propósito más estricto que el resto del proyecto, porque aquí el
  límite es "quién puede diagnosticar" (restricción legal, no solo de
  producto).

`intake_by`/`intake_at` y `clinical_by`/`clinical_at` registran quién
capturó cada bloque y cuándo.

**Fase 3 — auditoría de cambios (migración 019):** antes de cada
`UPDATE` en `consultations` o `medical_histories`, el trigger
`log_clinical_audit()` copia la fila completa **como estaba antes** a
`clinical_audit_log` (snapshot en `jsonb`, no solo los campos que
cambiaron). Tabla histórica, no de uso diario — solo admin puede leerla
(`auth_is_admin()`), sin política de insert/update/delete (solo el
trigger, `security definer`, escribe ahí — mismo patrón que el kardex
inmutable de `pharmacy_movements`). **No hay todavía una pantalla para
navegar el historial de versiones** — el dato queda capturado y seguro,
pero si se quiere ver "cómo estaba esta nota antes de la corrección"
hoy solo se puede consultando la tabla directamente; construir esa
pantalla es trabajo futuro si se pide. También se agregó
`consultations.updated_by`, y tanto en signos vitales
(`ConsultationForm.tsx`) como en cada bloque de la historia clínica
(`MedicalHistorySection.tsx`) ahora se muestra "Última edición: fecha y
hora, por quién".

**Catálogo de especialidades + modal de historia clínica (migración
020):** `doctors.specialty` pasó de texto libre a catálogo controlado
(`lib/specialties.ts`, check constraint) — arranca con "Médico general"
(área médica) y "Dentista" (área dental); pediatría se omitió por ahora
(ver NEGOCIO.md sección 13). El bloque clínico de `medical_histories` a
exigir ahora se decide por el área del doctor de esa cita, no por
`clinics.type` (que se deja de usar para esto, sin borrar la columna) —
esto corrige un bug real: antes una clínica mixta hubiera exigido el
bloque médico y el dental juntos, bloqueando para siempre a un paciente
que solo usa un tipo de servicio. Además, cuando falta historia clínica
obligatoria, el formulario ahora aparece en un **modal** (se puede
cerrar para ver otra cosa en pantalla, dejando un aviso permanente para
reabrirlo) en vez de vivir siempre incrustado — pero **"Terminar
consulta" queda bloqueado** mientras siga incompleta, que es el punto
real donde la norma exige que la visita no quede sin documentar.
Requirió un componente cliente nuevo, `ConsultaClient.tsx`, que agrupa
`MedicalHistorySection.tsx` + `ConsultationForm.tsx` (antes
independientes) para compartir ese estado de completitud.

**Comparación contra el texto oficial de NOM-004 + checks de
tabaco/alcohol (migración 021):** se investigó el numeral 6.1 y el
Apéndice A de la norma para revisar qué tan completo está el formulario
— no hay un formato único obligatorio (numeral 5.13 deja que cada
institución diseñe el suyo), así que el enfoque general ya era correcto.
Se corrigió un hallazgo real: "tabaquismo/alcohol/otras sustancias
psicoactivas" iba mal ubicado (estaba en el placeholder de "personales
no patológicos", la norma lo pide dentro de "personales patológicos").
Ahora son **3 checks** (`tobacco_use`, `alcohol_use`,
`other_substances_use`, cada uno con su `*_detail` opcional) en vez de
texto libre — un checkbox siempre tiene respuesta válida, así que no
suman a la validación de "campo obligatorio".

**Frecuencia cardiaca y respiratoria (migración 022):** la norma exige
estos dos junto con temperatura/presión arterial en la exploración
física — `consultations` no los capturaba. Se agregaron
`heart_rate_bpm`/`respiratory_rate_rpm`, con sus campos en el formulario
de signos vitales (`ConsultationForm.tsx`) y ya aparecen en la vista
previa/receta impresa ("FC: Xlpm", "FR: Xrpm").

Queda pendiente, de menor prioridad: enriquecer "Exploración física" con
una guía más estructurada (hoy es un solo textarea libre). Ver
NEGOCIO.md sección 13 para el detalle completo.

**Bug corregido: el modal de historia clínica se cerraba solo a media
escritura.** `intakeComplete`/`clinicalComplete` en
`MedicalHistorySection.tsx` se recalculaban en cada tecla a partir de
`history` (estado en vivo) — en cuanto el último campo obligatorio dejaba
de estar vacío (ej. al escribir en "Alergias"), el modal se cerraba solo
y la sección saltaba a la vista inline, aunque nadie hubiera dado
"Guardar" todavía. Peor aún: `historyComplete` (el que bloquea "Terminar
consulta") también se hubiera reportado como completo sin que nada se
hubiera guardado de verdad. Se corrigió convirtiendo ambos en estado que
**solo se actualiza dentro de `saveIntake`/`saveClinical` al guardar con
éxito** — ya no dependen de cada tecla, dependen de lo que realmente
quedó persistido.

**Rediseño: accesos de historia clínica movidos al banner del paciente +
side panel de consultas anteriores.** A petición de Tony, la pantalla
de consulta se reorganizó:
- `PatientInfoCard.tsx` (el banner del paciente) es ahora el **hub de
  todos los accesos**: "Consultas anteriores", "Antecedentes" (Ver/
  Editar), "Exploración y diagnóstico" (Ver/Editar), y la ficha de
  identificación pendiente — ya no viven repartidos en la tarjeta de
  historia clínica.
- `MedicalHistorySection.tsx` dejó de dibujar su propia tarjeta/botones:
  ahora es puramente los tres modales (antecedentes, exploración y
  diagnóstico, ficha de identificación), **controlados desde afuera**
  (`intakeMode`/`clinicalMode`: `closed`/`view`/`edit`). "Ver" deja los
  campos deshabilitados (mismo textarea, no texto plano); un botón
  "Editar" dentro del propio modal cambia a modo edición sin cerrarlo.
  Esto también simplificó el candado de "Terminar consulta": ya no hace
  falta el contador `forceOpenSignal`, `ConsultaClient.tsx` simplemente
  pone el modo en `"edit"` directo.
- Nuevo `PatientVisitsPanel.tsx`: side panel de consultas anteriores
  **específico de esta pantalla** (no reemplaza `PatientHistoryModal.tsx`,
  que sigue tal cual en `/dashboard/pacientes` — decisión explícita de
  no unificarlos por ahora). Dos paneles apilados desde la derecha, 1/3
  de la pantalla cada uno: lista de citas pasadas, y al seleccionar una,
  un segundo panel encima con el detalle de solo lectura — signos
  vitales, notas/padecimiento, y **tratamiento** (esto último no se
  mostraba antes en ningún historial, se agregó el join a
  `prescription_items`). "← Regresar" cierra solo el detalle; clic
  afuera cierra ambos. Ambos paneles se deslizan al entrar/salir
  (doble `requestAnimationFrame`, no un `setTimeout` corto — con eso
  solo se veía la animación de salida, nunca la de entrada, porque el
  navegador a veces pintaba ya con el estado final sin nada que animar).

**Revisión final antes de mostrárselo al Doctor (2026-09-30):**
- **Grupo étnico** (migración 023) y **guía de exploración física** —
  los dos pendientes menores de la comparación con NOM-004, ya
  resueltos (ver sección de arriba).
- **Aviso de privacidad** — nuevo hallazgo, aparte de NOM-004: la
  LFPDPPP exige avisar (y para datos de salud, pedir consentimiento
  expreso) desde el primer contacto, con independencia de si hay
  procedimientos de riesgo o no. Se implementó el borrador en
  `/aviso-de-privacidad` (ruta pública, linkeada desde `/login`) con los
  datos propios de la clínica marcados para que el Doctor los complete
  y apruebe — falta, como siguiente paso, la captura de consentimiento
  expreso por paciente (checkbox + fecha), que no se construyó todavía
  a propósito (se pidió el borrador y la página, no eso).
- **Contexto operativo:** el acuerdo con el Doctor es usar la app con
  **datos ficticios** hasta poder certificar el software — están en
  etapa de construcción/feedback, no con pacientes reales todavía. Esto
  baja la urgencia del riesgo de backups de Supabase Free (sigue
  pendiente, pero ya no es una pérdida de expediente real mientras los
  datos sean ficticios) — hay que revisitarlo antes de pasar a datos
  reales, no después. Ver NEGOCIO.md sección 13 para el detalle.

**Apertura automática de modales (2026-10-04):** al entrar a la
pantalla de consulta, si falta algo importante (ficha de identificación
y/o historia clínica), el modal correspondiente se abre solo en modo
edición, en vez de esperar a que alguien entre al banner a buscarlo —
pedido explícito de Tony. Cada bloque se abre solo si le falta a quien
está viendo la pantalla en ese momento (mismo criterio de siempre: a
enfermería no se le abre el bloque clínico, que no puede editar). Si
más de un bloque está incompleto a la vez, los modales quedan apilados
y se cierran uno a uno. Si sigue sin completarse, se vuelve a abrir en
la siguiente visita — a propósito, mismo espíritu que el resto del
candado de historia clínica.

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
