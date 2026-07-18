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
