# ClinicSaaS

Sistema de agenda y pacientes para clínicas médicas/dentales. Multi-tenant:
cada clínica ve solo sus propios datos gracias a Row Level Security en
Supabase.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Postgres + Auth + RLS) — plan Free
- Tailwind CSS
- Deploy sugerido: Vercel (plan Hobby, gratis)

Costo durante el piloto: **$0/mes**.

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta / proyecto nuevo (plan Free).
2. En el **SQL Editor**, pega y ejecuta el contenido de `supabase/schema.sql`.
   Esto crea todas las tablas y las políticas de seguridad (RLS).
3. Ve a **Settings > API** y copia:
   - `Project URL`
   - `anon public key`

## 2. Configurar el proyecto localmente

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno y completarlas
cp .env.example .env.local
# Edita .env.local con tu URL y anon key de Supabase
```

## 3. Crear tu primera clínica y usuario admin

Por ahora esto se hace manualmente (fase piloto, sin registro público):

1. En Supabase, ve a **Authentication > Users > Add user** y crea un usuario
   con el correo/contraseña del admin de la clínica piloto.
2. En el **SQL Editor**, corre:

```sql
insert into clinics (name, type, phone)
values ('Nombre de la clínica', 'dental', '2461234567')
returning id;
-- copia el id que regresa
```

3. Con el `id` de la clínica y el `id` del usuario que creaste (lo ves en
   Authentication > Users), corre:

```sql
insert into users (id, clinic_id, full_name, role)
values ('uuid-del-usuario', 'uuid-de-la-clinica', 'Nombre del admin', 'admin');
```

4. Listo. Ya puedes iniciar sesión con ese correo en `/login`.

## 4. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## 5. Deploy gratis en Vercel

1. Sube este proyecto a un repo de GitHub.
2. En [vercel.com](https://vercel.com), importa el repo.
3. Agrega las mismas variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`) en la configuración del proyecto.
4. Deploy. Tu app queda en `tuapp.vercel.app`, gratis.

## Estructura del proyecto

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

## Próximos pasos sugeridos (fase 2)

- Formulario para crear/editar citas y pacientes (ahorita solo se listan)
- Recordatorios automáticos por email (Resend, gratis hasta 3,000/mes) o
  WhatsApp Business Cloud API
- Reportes: citas por mes, tasa de no-shows, ingresos
- Vista de calendario semanal por doctor
