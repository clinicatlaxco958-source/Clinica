"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { normalizeMxPhone } from "@/lib/phone";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let normalizedPhone: string | null = null;
    if (method === "phone") {
      normalizedPhone = normalizeMxPhone(phone);
      if (!normalizedPhone) {
        setError("El teléfono debe tener 10 dígitos (México).");
        return;
      }
    }

    setLoading(true);
    const { error } =
      method === "email"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signInWithPassword({
            phone: normalizedPhone as string,
            password,
          });

    if (error) {
      setError(
        method === "email"
          ? "Correo o contraseña incorrectos."
          : "Teléfono o contraseña incorrectos."
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard/citas");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">
          ClinicSaaS
        </h1>
        <p className="mb-4 text-sm text-slate-500">
          Ingresa con tu cuenta de staff.
        </p>

        <div className="mb-4 flex border-b border-slate-200">
          {(
            [
              { id: "email", label: "Correo" },
              { id: "phone", label: "Teléfono" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMethod(tab.id);
                setError(null);
              }}
              className={`-mb-px border-b-2 px-3 pb-2 text-sm font-medium ${
                method === tab.id
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {method === "email" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Correo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Teléfono
              </label>
              <input
                type="tel"
                required
                placeholder="10 dígitos"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">
                Contraseña
              </label>
              {method === "email" && (
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
