import { createClient } from "@supabase/supabase-js";

// Usa la service_role key: bypassa RLS por completo. Importar SOLO desde
// Server Actions ("use server"), nunca desde un Client Component.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
