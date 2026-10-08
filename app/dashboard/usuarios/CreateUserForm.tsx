"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createStaffUser } from "./actions";
import { SPECIALTIES } from "@/lib/specialties";

// Oculto a propósito junto con el resto del módulo de Farmacia (ver
// components/DashboardNav.tsx) — el Doctor todavía no lo ha visto.
const PHARMACY_VISIBLE = false;

export default function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    email?: string;
    phone?: string;
    tempPassword: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [role, setRole] = useState("");

  function closeModal() {
    setOpen(false);
    setError(null);
    setCreated(null);
    setRole("");
  }

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createStaffUser(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("tempPassword" in result) {
        setCreated({
          email: result.email,
          phone: result.phone,
          tempPassword: result.tempPassword,
        });
        formRef.current?.reset();
        setRole("");
      }
    });
  }

  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        + Nuevo usuario
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className="absolute inset-0"
            onClick={closeModal}
            aria-hidden="true"
          />

          <div className="relative w-full max-w-[568px] rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
            {created ? (
              <div className="text-sm">
                <p className="font-medium text-green-800">
                  Usuario {created.email || created.phone} creado.
                </p>
                <p className="mt-1 text-green-700">
                  Contraseña temporal (compártela solo con esta persona, no
                  se volverá a mostrar):{" "}
                  <code className="rounded bg-slate-100 px-2 py-1 font-mono">
                    {created.tempPassword}
                  </code>
                </p>
                <button
                  onClick={closeModal}
                  className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-4 text-base font-semibold text-slate-900">
                  Nuevo usuario
                </h2>
                <form ref={formRef} action={handleSubmit}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Nombre completo
                      </label>
                      <input
                        name="full_name"
                        required
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Correo
                      </label>
                      <input
                        type="email"
                        name="email"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        placeholder="10 dígitos"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <p className="col-span-2 -mt-2 text-xs text-slate-400">
                      Captura correo o teléfono (al menos uno). El teléfono
                      todavía no valida por SMS, solo formato.
                    </p>
                    <div className="col-span-2">
                      <label className="mb-1 block text-sm font-medium text-slate-700">
                        Función
                      </label>
                      <select
                        name="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        <option value="">Sin función clínica (staff)</option>
                        <option value="doctor">Doctor</option>
                        <option value="nurse">Enfermería</option>
                        <option value="receptionist">Recepcionista</option>
                      </select>
                    </div>
                    {role === "doctor" && (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Especialidad (opcional)
                          </label>
                          <select
                            name="specialty"
                            defaultValue=""
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="">Sin especificar</option>
                            {SPECIALTIES.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-slate-700">
                            Duración de consulta (min, opcional)
                          </label>
                          <input
                            type="number"
                            name="duration_minutes"
                            min={1}
                            step={1}
                            placeholder="Ej. 30"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </>
                    )}
                    <div className="col-span-2 flex items-center gap-2">
                      <input type="checkbox" id="is_admin" name="is_admin" />
                      <label
                        htmlFor="is_admin"
                        className="text-sm text-slate-700"
                      >
                        Dar permiso de administrador
                      </label>
                    </div>
                    {PHARMACY_VISIBLE && (
                      <div className="col-span-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="is_pharmacy"
                          name="is_pharmacy"
                        />
                        <label
                          htmlFor="is_pharmacy"
                          className="text-sm text-slate-700"
                        >
                          Dar acceso a farmacia
                        </label>
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="mt-3 text-sm text-red-600">{error}</p>
                  )}

                  <div className="mt-5 flex gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {pending ? "Creando..." : "Crear usuario"}
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
