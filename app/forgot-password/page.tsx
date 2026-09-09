"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError("No se pudo enviar el correo. Intenta de nuevo más tarde.");
      return;
    }

    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          Recuperar contraseña
        </h1>

        {sent ? (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Si <span className="font-medium">{email}</span> tiene una
              cuenta, te enviamos un correo con instrucciones para restablecer
              tu contraseña.
            </p>
            <Link
              href="/login"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Ingresa tu correo y te enviaremos un enlace para restablecer tu
              contraseña.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-slate-700"
                >
                  Correo
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

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
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>

              <Link
                href="/login"
                className="block text-center text-sm text-slate-500 hover:text-slate-700"
              >
                Volver a iniciar sesión
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
