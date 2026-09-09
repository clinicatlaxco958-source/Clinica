"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("error=")) {
      setHasSession(false);
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setCheckingSession(false);
    });
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("No se pudo actualizar la contraseña. Intenta de nuevo.");
      setLoading(false);
      return;
    }

    router.push("/dashboard/citas");
    router.refresh();
  }

  if (checkingSession) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Restablecer contraseña
        </h1>

        {!hasSession ? (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Este enlace es inválido o ya expiró. Solicita uno nuevo.
            </p>
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Solicitar nuevo enlace
            </Link>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Define tu nueva contraseña.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <PasswordField
                label="Nueva contraseña"
                value={password}
                onChange={setPassword}
              />
              <PasswordField
                label="Confirmar contraseña"
                value={confirm}
                onChange={setConfirm}
              />

              {error && (
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Guardar contraseña"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
