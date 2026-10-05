# ClinicSaaS — Documentación del proyecto

## 1. Idea de negocio

SaaS de renta mensual para clínicas médicas y dentales en comunidades
pequeñas/medianas que actualmente administran sus citas en papel o Excel.

**Problema que resuelve:**
- No-shows (pacientes que no llegan) por falta de recordatorios
- Doble reserva o citas encimadas
- Sin historial centralizado de pacientes
- Difícil ver ocupación de doctores/consultorios
- Cobros y pagos desorganizados

**Modelo de negocio:** renta mensual por clínica, niveles según número de
doctores/consultorios (ej. 1-2 doctores, 3-5, 6+). Posible cobro de setup
inicial por migrar datos de Excel/papel.

**Estrategia de validación:** ofrecer gratis 1-2 meses a una clínica piloto
conocida antes de construir todo el producto, para validar interés real
antes de invertir tiempo/dinero.

## 2. Restricción de costos (fase piloto)

Objetivo: **$0/mes** hasta conseguir el primer cliente pagando.

| Servicio | Plan | Costo |
|---|---|---|
| Supabase | Free (500MB DB, 1GB storage, 50k MAU) | $0 |
| Vercel | Hobby | $0 |
| Notificaciones | Email vía Resend (3,000/mes gratis) en vez de WhatsApp/SMS | $0 |
| Dominio | Subdominio `.vercel.app` por ahora | $0 |

Subir a Supabase Pro ($25 USD/mes, con backups diarios y point-in-time
recovery) solo cuando haya clientes reales pagando.

**Nota legal (México):** datos de salud son "datos sensibles" bajo la
Ley Federal de Protección de Datos Personales en Posesión de los
Particulares. Requiere aviso de privacidad y medidas de seguridad
reforzadas (cifrado, control de acceso por roles — ya cubierto por RLS
de Supabase).

## 3. Stack técnico

- **Frontend/Backend:** Next.js 14 (App Router) + TypeScript
- **Base de datos + Auth:** Supabase (Postgres + Auth + Storage + Row
  Level Security para aislar datos entre clínicas)
- **Estilos:** Tailwind CSS
- **Deploy:** Vercel
- **Notificaciones (fase 2):** Resend (email) o WhatsApp Business Cloud API

## 4. Modelo de datos (multi-tenant)

Cada clínica es un tenant aislado vía `clinic_id` + Row Level Security
(cada clínica solo ve sus propios datos, aplicado a nivel de base de
datos, no solo en el código).

Estados de una cita: `pendiente`, `confirmada`, `completada`, `cancelada`,
`no_show`.

Schema SQL completo con políticas RLS está en
[supabase/schema.sql](supabase/schema.sql). Ver también [CLAUDE.md](CLAUDE.md)
para el detalle técnico de tablas, políticas RLS y arquitectura de código.

## 5. MVP — alcance definido

**Incluido en el MVP:**
- Login de staff (email/password vía Supabase Auth)
- Agenda del día por clínica (lista de citas: hora, paciente, doctor,
  estado, pago)
- Listado de pacientes
- Aislamiento de datos por clínica (multi-tenant real)

**Ya construido (scaffold inicial):**
- Estructura completa del proyecto Next.js + Supabase
- Schema SQL con RLS
- Login funcional
- Vistas de agenda y pacientes conectadas a la base de datos (solo
  lectura por ahora)
- Middleware que protege rutas del dashboard

**Pendiente (próximos pasos):**
- Formularios para crear/editar citas y pacientes (crear/editar,
  actualmente solo se listan)
- Recordatorios automáticos por email
- Reportes: citas por mes, tasa de no-shows, ingresos
- Vista de calendario semanal por doctor
- Registro de pagos por cita

**Fuera de alcance por ahora (fase 2-3):**
- Facturación electrónica
- Inventario de insumos
- Expediente clínico completo
- Recetas digitales

## 6. Estructura del proyecto

```
app/
  login/           → página de inicio de sesión
  dashboard/
    citas/         → agenda del día
    pacientes/     → listado de pacientes
lib/supabase/      → clientes de Supabase (browser + server)
components/        → componentes compartidos de UI
supabase/schema.sql → schema completo con RLS
middleware.ts       → protege rutas /dashboard, requiere sesión
```

Ver [CLAUDE.md](CLAUDE.md) para el detalle de por qué hay dos clientes de
Supabase distintos y cómo se relacionan middleware/layout en la
autenticación.

## 7. Setup para desarrollo local

1. Crear proyecto en supabase.com (plan Free)
2. Correr `supabase/schema.sql` en el SQL Editor de Supabase
3. Copiar `.env.example` a `.env.local` con `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Crear manualmente la primera clínica y usuario admin (ver README.md
   del proyecto para el SQL exacto)
5. `npm install && npm run dev`

## 8. Gestión de usuarios y permisos (decidido, pendiente de implementar)

**No hay registro público.** El login no tiene opción de "crear cuenta" —
en su lugar, un link/formulario tipo "¿Te interesa? Solicita una demo"
(fuera del flujo de autenticación). Las cuentas de clínica se crean
manualmente al contratar el servicio.

**Solo el permiso de administrador puede gestionar usuarios**: crear,
suspender, eliminar y restablecer contraseñas del staff de su propia
clínica. La cantidad de usuarios que puede crear depende del plan
contratado (niveles de plan aún por definir, ver sección 1).

**"Admin" es un permiso, no una función clínica separada.** Una misma
persona puede ser doctor o recepcionista *y además* tener permiso de
administrador (ej. la dueña de la clínica que también atiende pacientes).
Esto implica un cambio de modelo respecto al schema actual
(`supabase/schema.sql`), donde `role` hoy es un solo campo mutuamente
excluyente (`admin` **o** `doctor` **o** `receptionist`). El modelo
acordado separa dos conceptos:
- **Función clínica** (`role`): `doctor`, `receptionist`, o ninguna
  (alguien puramente administrativo).
- **Permiso de administración** (`is_admin`, booleano): independiente de
  la función; determina quién puede gestionar usuarios.

**Suspender vs. eliminar no son lo mismo:**
- *Suspender* (flag `active`/`status`) es el mecanismo del día a día — el
  usuario no puede iniciar sesión pero su historial (citas, notas) se
  conserva intacto. Importante porque hoy `appointments.doctor_id` usa
  `on delete set null` — borrar a un doctor con historial le quita el
  doctor asociado a sus citas pasadas.
- *Eliminar* se reserva para corregir errores (cuenta creada por
  equivocación), no para dar de baja a alguien que ya trabajó.

**Restablecer contraseñas requiere la `service_role` key de Supabase**,
que solo puede usarse server-side (Server Action / API route) — nunca
debe exponerse al navegador ni llevar el prefijo `NEXT_PUBLIC_`.

Los niveles de plan y sus límites están definidos en la sección 9.

Nada de esto está implementado todavía en el schema ni en la app — es
una decisión de diseño documentada para cuando se construya esta parte
(fuera del alcance del MVP actual, ver sección 5).

## 9. Planes y precios (niveles definidos)

El límite de plan se basa en **número de doctores**, no en staff total —
los doctores son la unidad que genera ingreso para la clínica, mientras
que el personal de apoyo (recepción, y roles no-doctor en general) varía
según cómo opera cada clínica y no debería ser lo que determina el precio
por sí solo.

| Plan | Doctores | Staff no-doctor (recepción, etc.) |
|---|---|---|
| Básico | hasta 4 | hasta 3× el número de doctores |
| Intermedio | 5–10 | hasta 3× el número de doctores |
| Plus | 11+ (tope a definir, ej. 20) | hasta 3× el número de doctores |

**Regla del staff no-doctor — tope dinámico, no fijo:** cada clínica puede
tener hasta **3 usuarios no-doctor por cada doctor** en su plan (ej. 1
doctor → hasta 3 no-doctores; 4 doctores → hasta 12). Razón: una clínica
pequeña con muchos más de 3 no-doctores por doctor probablemente está
ofreciendo servicios adicionales que generan ingreso (rayos X, análisis
clínicos, etc.), no solo apoyo administrativo — y ese caso debe reflejarse
en el precio.

**Comportamiento al llegar al tope: sugerir upgrade, no bloquear.** En vez
de impedir la creación de un usuario nuevo al llegar al límite de 3×, la
app debe **sugerir subir de plan o comprar un add-on de usuarios extra**.
Esto evita bloquear a una clínica legítima que necesita más personal de
recepción sin servicios adicionales reales (ej. un solo doctor muy
ocupado que requiere 4 personas solo para agenda telefónica), mientras
sigue capturando el caso donde sí hay ingreso adicional que debería
pagar más.

**Nota de nomenclatura (rol vs. puesto):** para el límite de plan solo
importa "es doctor" vs. "no es doctor". El rol `receptionist` en el
schema actual es demasiado específico para cubrir técnicos de rayos X,
laboratoristas, etc. — al implementar esto, considerar un rol más
genérico (ej. `staff`) en vez de forzar que todo no-doctor se llame
"recepcionista".

**Pendiente de definir:** precios en MXN/mes por nivel (se definirán con
la clínica piloto), y el tope superior exacto del plan Plus.

## 10. Agenda / calendario (decidido, pendiente de implementar)

**Filtro de doctor dentro de la misma vista, no calendarios/rutas
separadas por doctor.** Quién usa la pantalla de agenda varía:
- Recepción/admin necesita ver **todos los doctores** juntos, para saber
  a quién agendar.
- Un doctor probablemente solo quiere ver **su propia agenda**.
- Al crear una cita nueva, hay que enfocarse en un doctor específico para
  ver sus huecos libres — el mismo selector de doctor se reutiliza ahí.

Un selector (`Todos` / `Dr. X` / `Dra. Y`) arriba del calendario cubre los
tres casos sin duplicar pantallas.

**Un solo "home", sin fork de ruta por rol.** `/dashboard/citas` sigue
siendo el destino para todos los roles después de iniciar sesión — no se
crean rutas de entrada distintas por rol (más complejidad de
redirecciones, más pantallas que mantener). En vez de eso, el **contenido
se adapta con un default inteligente**: si quien entra es doctor, el
filtro de doctor arranca en "yo"; si es recepción/admin, arranca en
"todos". Personalización sin la complejidad de tener homes distintos.

**Vistas de calendario:** día (default, hoy), semana y mes, con
navegación entre ellas. **Implementado** con `react-big-calendar`
(licencia MIT, gratis) — ver `app/dashboard/citas/AgendaCalendar.tsx`.

## 11. Duración de consulta y horario del doctor (implementado)

Para que "+ Nueva cita" pueda sugerir horarios válidos y evitar encimar
citas, cada doctor necesita dos datos de configuración:

- **Duración estimada de consulta** (minutos por cita). Se captura como
  campo opcional en el formulario de creación de usuario (mismo patrón
  que "Especialidad" cuando el rol es doctor) — si se deja vacío, usa un
  default global de la clínica. Es un solo número, no le agrega
  complejidad relevante al modal de alta.
- **Horario semanal de disponibilidad** (qué días/horas atiende). Esto
  **no** va en el modal de creación de usuario — es una UI más grande
  (varios bloques de día/hora) que merece su propia sección, configurada
  después de que el usuario ya existe.

**Quién lo edita:** el propio doctor puede autogestionar su horario y
duración desde su perfil (ej. "hoy salgo temprano"), sin depender de
pedírselo al admin cada vez. El admin también puede editarlo como
respaldo (mismo patrón que el resto de gestión de usuarios: el admin
tiene el permiso más amplio, pero aquí el doctor también tiene acceso a
lo suyo).

**Alcance inicial (mantenerlo simple):** por ahora es un horario **fijo**
(una sola hora de inicio y fin, sin variar por día de la semana), sin
excepciones (días festivos, vacaciones) ni tipos de consulta con
duraciones distintas — eso queda para una fase posterior si la clínica
piloto lo pide (ver `PROGRESS.md`, "Próximos pasos").

**Implementado:** `doctors.default_duration_minutes`,
`doctors.work_start_time`/`work_end_time` (con default a nivel
`clinics` si el doctor no los define), editable desde `/dashboard/perfil`.
La cuadrícula del calendario y el selector de horas de "Nueva cita" ya
usan estos valores.

## 12. Consultas, recetas e historial clínico (implementado)

**Alcance del expediente clínico — mínimo viable a propósito.** Se
decidió no construir un expediente completo desde el inicio, sino
arrancar angosto: signos vitales (peso, talla, temperatura, presión) +
notas de consulta + receta de medicamentos, todo ligado a la cita. Se
amplía después según lo que el doctor realmente use en el día a día.

**División de quién puede hacer qué dentro de una cita:**
- **El doctor dueño de la cita** puede iniciar la "Consulta" completa:
  ver/editar signos vitales, escribir notas de consulta, y prescribir
  medicamentos.
- **Recepción** (o cualquier staff sin función de doctor) solo puede
  **capturar signos vitales** — no ve ni puede escribir notas de
  consulta ni la receta. Esto refleja que tomar peso/talla/temperatura/
  presión es una tarea común de recepción antes de que el doctor pase al
  paciente, pero diagnosticar y prescribir es exclusivo del doctor.
- **La regla de "de quién es la cita" se decide comparando el doctor
  dueño de la cita contra quien tiene la sesión abierta** — no por rol.
  Esto importa porque una misma persona puede ser doctor y admin a la
  vez (ver sección 8): un doctor-admin viendo la agenda de un colega NO
  debe poder "iniciar consulta" en una cita que no es suya, aunque sí sea
  doctor. Ver `CLAUDE.md` para el detalle técnico (comparación de
  `doctor_id` de la cita contra el `auth_doctor_id()` del usuario).

**Cubrir a un doctor ausente:** si un doctor no puede llegar y otro
doctor (con permiso de admin) decide atender sus citas, la forma correcta
es **reasignar la cita** al doctor que efectivamente va a atender —no
darle acceso especial a "iniciar consulta" en citas ajenas. Así el
registro queda correcto (quién realmente vio al paciente), en vez de
decir que lo vio el doctor original cuando no fue así. Solo admin/
recepción pueden reasignar (un doctor no-admin no puede mover una cita
suya a otro doctor por su cuenta).

**Receta médica:** cada medicamento tiene nombre, **presentación**
(tableta, cápsula, jarabe/suspensión, gotas, inyección/ampolleta,
crema/ungüento, u "otro" con instrucción libre), cantidad, frecuencia
(cada cuántas horas) y duración (cuántos días). La presentación
determina el verbo y la unidad al armar la frase ("Tomar 1 tableta...",
"Aplicar 5 gotas..."); "otro" existe para casos que no se dosifican con
un número limpio (ej. cremas: "aplicar una capa delgada..."). Hay vista
previa de la receta en pantalla, pero **todavía no hay forma de
imprimirla** (ver `PROGRESS.md`).

**Historial de paciente:** desde la lista de pacientes o desde la propia
pantalla de consulta, se puede ver el historial de consultas de un
paciente — respeta la misma regla de acceso (un doctor solo ve las
consultas que él mismo tuvo con ese paciente).

## 13. Historia clínica y cumplimiento normativo (decidido, pendiente de implementar)

**Por qué esta sección existe.** El Doctor de la clínica piloto pidió un
módulo de "historia clínica" que cumpla con **NOM-024-SSA3-2012**. Al
investigar quedó claro que en realidad aplican dos normas distintas:
**NOM-004-SSA3-2012** ("Del expediente clínico") define el *contenido*
obligatorio de la historia clínica (ficha de identificación, antecedentes
heredo-familiares/personales patológicos/personales no patológicos,
padecimiento actual, exploración física, diagnóstico, pronóstico, plan de
tratamiento); **NOM-024-SSA3-2012** son requisitos *del sistema*
(auditoría/trazabilidad de cambios, no-alterabilidad de notas cerradas,
control de acceso — ya cubierto por RLS —, conservación de datos). A esto
se suma la **LFPDPPP** (datos de salud como datos sensibles, ver sección
2) y, si algún día se atiende una clínica dental, **NOM-013-SSA2-2015**
(antecedentes/odontograma específicos de odontología).

**Nivel de cumplimiento elegido:** contenido NOM-004 completo +
integridad/auditoría básica de NOM-024. **Explícitamente fuera de
alcance por ahora**: firma electrónica avanzada certificada (NOM-151) e
interoperabilidad real (HL7, catálogos nacionales) — es un proyecto mucho
más grande que el resto de la app junta, no se justifica para una clínica
piloto de un consultorio.

**La historia clínica distingue médica vs. dental desde el diseño**
(según `clinics.type`, que ya existe en el schema): comparten un núcleo
común (ficha de identificación, antecedentes) pero cada tipo tiene su
sección específica. El odontograma interactivo (mapa de 32 dientes) se
empieza como campo de texto/JSON simple — un componente visual real de
odontograma es una feature grande por sí sola, se evalúa después si la
clínica dental piloto lo necesita.

**Captura progresiva de datos — regla importante para no salirse de la
norma.** El Doctor pidió que la historia clínica se capture en la primera
consulta igual que los signos vitales, y que si algún dato no se pudo
capturar (ej. CURP porque el paciente no trae su identificación), el
sistema lo recuerde como pendiente en visitas siguientes hasta
completarse. Esto es válido **solo si se separan dos tipos de campo**:

- **Núcleo clínico — obligatorio en la primera consulta, nunca queda
  pendiente:** antecedentes heredo-familiares, antecedentes personales
  patológicos (incluye **alergias**, dato crítico de seguridad),
  antecedentes personales no patológicos, padecimiento actual,
  exploración física, diagnóstico y plan de tratamiento. Todo esto se
  obtiene hablando con el paciente, no depende de que traiga un
  documento — no hay excusa legítima para posponerlo, y posponerlo
  (sobre todo alergias) es un riesgo real si el doctor prescribe antes de
  tener esa información.
- **Datos administrativos — sí pueden quedar pendientes con recordatorio
  persistente:** CURP (requiere identificación oficial física), domicilio
  completo/código postal, tipo de sangre (si el paciente no lo sabe de
  memoria), contacto de emergencia. Estos son los que justifican el botón
  de "completar datos pendientes" reapareciendo en la 2a/3a visita hasta
  llenarse.

Cuando un dato pendiente se llena después (ej. la CURP en la tercera
visita), la auditoría (sección de integridad, ver `CLAUDE.md` cuando se
implemente) debe registrar la fecha real en que se capturó, **no**
la fecha de la primera consulta — importante para la trazabilidad que
exige NOM-024.

**Regla de acceso propuesta (a confirmar al implementar):** cualquier
doctor de la clínica puede *ver* la historia clínica de cualquier
paciente (continuidad de atención, es el propósito de NOM-004), pero solo
un doctor —no recepción— puede *editarla*, igual que las notas de
consulta (sección 12).

**Rol de enfermería y captura en el lobby antes de la consulta
(implementado, migración 018).** El Doctor pidió que el interrogatorio/
antecedentes de la primera visita se capturen en el lobby, antes de que
el paciente pase a consulta, para no quitarle tiempo de consultorio.
Esto es válido según NOM-004 **solo si lo hace personal de salud**
(enfermería), no una recepcionista/secretaria administrativa — por eso
se agregó un rol nuevo `nurse` ("Enfermería" en la interfaz), **separado**
de `receptionist` (una clínica puede tener ambas figuras a la vez, no se
reemplazó el rol existente).

Dentro de la propia historia clínica hay dos bloques con distinto dueño:

- **Interrogatorio/antecedentes** ("intake": heredo-familiares,
  personales patológicos/no patológicos, alergias, padecimiento actual,
  interrogatorio por aparatos y sistemas, estudios previos, antecedentes
  odontológicos) — es lo que narra el paciente. Lo puede capturar
  **enfermería, el doctor, o admin**.
- **Juicio clínico** (exploración física, diagnóstico, pronóstico, plan
  de tratamiento, y sus equivalentes dentales: exploración bucal,
  diagnóstico dental, plan de tratamiento dental, odontograma) — **sigue
  siendo exclusivo del doctor/admin sin importar el nombre del rol**.
  Diagnosticar y prescribir tratamiento está reservado por ley al médico
  con cédula profesional — no es negociable con solo cambiarle el nombre
  a un puesto administrativo, y por eso no basta con documentarlo:
  además de las políticas RLS, hay un **trigger en la base de datos**
  (`medical_histories_restrict_clinical_fields`) que rechaza cualquier
  intento de tocar esas columnas si quien hace la operación no es doctor
  ni admin, incluso si alguien llamara a la API directo saltándose la
  interfaz. Es una excepción a propósito más estricta que el resto del
  proyecto (que en casos similares, como `consultations.notes`, confía
  solo en que la app no mande ese campo) — aquí el costo de un error
  (un diagnóstico atribuible a alguien sin licencia médica) es mayor.

Enfermería sí puede **ver** (no editar) el juicio clínico ya capturado
por el doctor, para dar continuidad de cuidados sin poder modificarlo.

Se agregaron `intake_by`/`intake_at` y `clinical_by`/`clinical_at` en
`medical_histories` para identificar quién capturó cada bloque —versión
mínima y adelantada de la trazabilidad de autoría que NOM-004 exige.

**Fase 3 — auditoría de cambios (implementada, migración 019).** Falta
el requisito de que ninguna nota clínica se pueda sobreescribir sin dejar
rastro de qué decía antes. Se agregó `clinical_audit_log`: antes de cada
edición de una consulta o de una historia clínica, el sistema guarda una
copia completa de cómo estaba esa fila justo antes del cambio. No cambia
nada de cómo el doctor/enfermería guarda su trabajo (sigue siendo el
mismo botón de siempre) — es una copia de seguridad automática por si
algún día hace falta revisar qué decía una nota antes de una corrección.
Por ahora es un archivo histórico, no una pantalla de consulta diaria:
solo el Administrador puede revisarlo, y no hay todavía una pantalla
para navegarlo cómodamente (se puede agregar si se necesita). También se
agregó `consultations.updated_by` y en la pantalla de consulta ahora se
ve "Última edición: fecha y hora, por quién" tanto en signos vitales
como en cada bloque de la historia clínica.

**Regla de trabajo permanente para cualquier sesión futura (pedida
explícitamente por Tony):** si un requerimiento de producto entra en
conflicto con NOM-004, NOM-024, LFPDPPP o cualquier otra norma
relacionada con datos de salud, **se debe señalar explícitamente antes de
implementarlo** — no implementarlo silenciosamente asumiendo que está
bien, y tampoco negarse sin explicar el conflicto concreto y ofrecer una
alternativa que sí cumpla.

**"Primera visita" se define por especialidad, no por clínica completa
ni por doctor individual (aclarado 2026-09-20, pendiente de corregir en
código).** El núcleo de antecedentes/alergias sí se comparte entre TODOS
los doctores de la clínica sin importar especialidad (ya está bien así).
Pero la exploración/diagnóstico inicial es distinta por especialidad: si
el paciente ya fue valorado por un médico general, otro médico general
de la misma clínica no debería repetir esa valoración (continuidad entre
doctores de la misma área) — pero si solo lo ha visto el dentista, el
médico general sí necesita hacer la suya la primera vez que lo atienda
(son exploraciones/diagnósticos distintos, uno no sustituye al otro).

**Bug de diseño — corregido (migración 020).** Antes, el bloque a exigir
se decidía por `clinics.type` (a nivel de toda la clínica): una clínica
mixta hubiera exigido el bloque médico Y el dental juntos, bloqueando
para siempre a un paciente que solo usa un tipo de servicio. Se corrigió
junto con el catálogo de especialidades (ver abajo): ahora el bloque
clínico a exigir se decide por el **área de la especialidad del doctor
de esa cita en particular**, no por el tipo de clínica — `clinics.type`
ya no se usa para esto (se deja la columna sin borrar, ver más abajo).

**Catálogo de especialidades (implementado, migración 020).** Antes
`doctors.specialty` era texto libre — nada impedía registrar un doctor
con una especialidad que no correspondiera a la clínica, y no había
forma estructurada de saber el "área" de cada doctor. Se decidió:
- **Catálogo global y fijo** (no personalizable por clínica) — vive en
  código (`lib/specialties.ts`), igual que la lista de presentaciones de
  medicamento. Ampliarlo el día de mañana (ej. si llega un pediatra) es
  una migración chica + agregar la entrada en el archivo.
- **Arranca con dos especialidades:** "Médico general" (área médica) y
  "Dentista" (área dental). Pediatría se mencionó como ejemplo pero se
  omite por ahora — cuando de verdad haga falta, ahí se decide si es una
  variante del área médica o un área propia con su propio bloque de
  historia clínica (ej. antecedentes perinatales, vacunación).
- `doctors.specialty` pasó de texto libre a lista controlada (dropdown
  en el alta de usuario y en el perfil del doctor, con check constraint
  en la base de datos).
- La app todavía no estaba en uso oficial, así que por indicación
  explícita de Tony la migración simplemente resetea cualquier
  especialidad que no calce con el catálogo nuevo, sin intentar
  preservar/migrar el texto libre anterior.

**Modal de historia clínica + candado en "Terminar consulta"
(implementado).** Cuando al paciente le falta historia clínica
obligatoria (el bloque que le corresponda según canEditIntake/
canEditClinical), el formulario aparece en un **modal** en vez de vivir
siempre incrustado en la pantalla de consulta (para no contaminarla).
Aclaración normativa importante que motivó este diseño: la norma no
exige bloquear que el doctor **vea** al paciente sin historia clínica
(no podría ser de otra forma, la historia clínica se genera durante ese
mismo primer encuentro) — exige que la **visita no quede cerrada sin
documentar**. Por eso:
- El modal **sí se puede cerrar** (botón × o clic fuera) para revisar
  otra cosa en pantalla mientras tanto — no atora al doctor.
- Si se cierra sin completarse, queda un aviso compacto y permanente
  ("⚠ Historia clínica incompleta — completar") para reabrirlo.
- El candado real vive en **"Terminar consulta"**: no se puede dar por
  terminada la consulta mientras falte el bloque obligatorio — ahí se
  reabre el modal automáticamente. Esto es válido para cualquier visita
  del paciente (no solo la primera), hasta que la historia clínica quede
  completa una sola vez; después de eso no se vuelve a pedir.
- A cada rol se le pide solo lo que le toca: a enfermería no se le
  muestra el modal por algo que no puede editar (el bloque clínico es
  del doctor); al doctor si le falta el bloque de enfermería (ej. no
  había enfermera disponible) también se le pide a él.

Técnicamente, esto requirió agrupar `MedicalHistorySection.tsx` y
`ConsultationForm.tsx` bajo un componente cliente nuevo,
`ConsultaClient.tsx`, que comparte el estado de "¿está completa la
historia clínica?" entre ambos (antes eran independientes entre sí).

**Comparación contra el texto oficial de NOM-004 (2026-09-29).** Se
investigó el texto completo de la norma (numeral 6.1 "Historia Clínica"
y el Apéndice A, que es la lista de verificación oficial) para revisar
qué tan completo está nuestro formulario. Conclusión importante: **no
existe un formato único obligatorio** — la norma (numeral 5.13) permite
que cada institución diseñe el suyo, siempre que cubra el contenido
mínimo; nuestro enfoque ya era el correcto. Hallazgos:

- **Corregido (migración 021):** "uso y dependencia del tabaco, del
  alcohol y de otras sustancias psicoactivas" lo pedía la norma dentro
  de *antecedentes personales patológicos* — nuestro placeholder lo
  tenía mal ubicado en *no patológicos*. Se convirtió en **3 checks**
  (tabaquismo/alcoholismo/otras sustancias), cada uno con un campo de
  detalle opcional que aparece solo si se marca "sí". Un checkbox
  siempre tiene respuesta válida (marcado o no), así que no participa en
  la validación de "campo obligatorio" como los demás antecedentes.
- **Corregido (migración 022):** la norma exige que los signos vitales
  de la exploración física incluyan temperatura, tensión arterial,
  frecuencia cardiaca y frecuencia respiratoria — `consultations` solo
  capturaba peso, talla, temperatura y presión arterial. Se agregaron
  `heart_rate_bpm` y `respiratory_rate_rpm`, visibles en el formulario de
  signos vitales y en la vista previa/receta impresa.
- **Corregido:** "Exploración física" seguía siendo un campo de texto
  libre sin guía — se enriqueció el placeholder para que recuerde cubrir
  cada región (habitus exterior, cabeza/cuello, tórax, abdomen,
  miembros, genitales si aplica). No se separó en columnas nuevas: la
  norma no exige esa estructura a nivel de base de datos, solo que el
  contenido esté.
- **Corregido (migración 023):** "grupo étnico" (numeral 6.1.1, "en su
  caso") no se capturaba. Se agregó como catálogo con los grupos más
  numerosos + "Otro (especifique)" en texto libre — no es el catálogo
  oficial completo del INPI (68 pueblos reconocidos), solo una lista
  práctica. Es opcional y **nunca cuenta** para el aviso de "datos
  pendientes" de la ficha de identificación (a diferencia de CURP/
  domicilio/etc., que sí son administrativos a completar eventualmente).
- **Idea en pausa (no se descarta, se retoma con más clínicas):** dar de
  alta un catálogo de campos + campos personalizados por clínica (como
  antes se hacía en papel). Viable como diferenciador de plan (NEGOCIO.md
  sección 9), pero con un límite que no se puede negociar: el núcleo
  obligatorio de NOM-004 tendría que quedar bloqueado/no removible por el
  Admin — solo se delegaría la posibilidad de *agregar* campos extra,
  nunca quitar los obligatorios.

**Aviso de privacidad — borrador implementado (2026-09-30), falta que el
Doctor lo complete y apruebe.** Es un hallazgo aparte de NOM-004: bajo la
LFPDPPP, cualquier negocio que recaba datos personales —y los de salud
son "datos sensibles", el nivel más protegido— debe avisarle al titular
qué datos recaba, para qué, y cómo ejercer sus derechos ARCO, **desde el
primer contacto**. Es distinto del "consentimiento informado" de
NOM-004 (que solo aplica a procedimientos específicos de riesgo:
cirugía, anestesia general, etc. — una clínica de consulta ambulatoria
normal no necesariamente entra en esa lista).

- **Es responsabilidad de cada clínica, no del software.** El
  "responsable" de los datos bajo la LFPDPPP es la clínica que los
  recaba, no ClinicSaaS. Por eso el borrador (`/aviso-de-privacidad`,
  ruta pública fuera de `/dashboard`) deja marcados en amarillo los
  datos propios de la clínica que el Doctor debe confirmar/llenar
  (nombre o razón social, domicilio, contacto para solicitudes de
  privacidad) — el resto del texto (qué datos se recaban, para qué, cómo
  se protegen) ya está redactado porque corresponde a cómo funciona el
  sistema, eso sí lo sabíamos.
- **Contenido estático a propósito**, no se jala de `clinics` en la base
  de datos — hoy solo hay una clínica piloto, y además la tabla
  `clinics` tiene RLS que requiere sesión (una página pública no podría
  leerla de todos modos). Si el día de mañana hay varias clínicas con
  avisos distintos, se vuelve una plantilla por clínica.
- **Pendiente, siguiente paso natural:** la LFPDPPP pide **consentimiento
  expreso** para datos sensibles (Art. 9) — no basta con publicar el
  aviso, hay que registrar que cada paciente lo aceptó. Falta construir
  esa captura (un checkbox con fecha, parecido a `intake_by`/`intake_at`)
  — se dejó fuera de este cambio a propósito porque lo que se pidió fue
  "el borrador y la página", no la captura de consentimiento todavía.

**Contexto operativo importante (2026-09-30): el acuerdo con el Doctor
es usar la app con datos ficticios hasta poder certificar el software.**
Están en etapa de construcción — específicamente, en la etapa donde el
Doctor da feedback de su experiencia usándola, todavía sin datos reales
de pacientes. Esto no cambia el estándar con el que se construye (se
sigue apuntando a cumplir NOM-004/NOM-024/LFPDPPP desde ahora, no
después), pero sí baja la urgencia inmediata de cosas como el riesgo de
backups (sección 13, Fase 3) — mientras los datos sean ficticios, perder
el proyecto de Supabase no es una pérdida de expediente clínico real.
Cuando se acuerde el paso a datos reales, hay que revisitar ese riesgo
antes de ese momento, no después.
