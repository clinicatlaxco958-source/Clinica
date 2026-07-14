"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStaffUser, resetStaffPassword, setUserActive } from "./actions";

export default function UserRowActions({
  userId,
  active,
  isSelf,
}: {
  userId: string;
  active: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleToggleActive() {
    setError(null);
    startTransition(async () => {
      const result = await setUserActive(userId, !active);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (
      !confirm(
        "¿Eliminar este usuario permanentemente? Esta acción no se puede deshacer."
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStaffUser(userId);
      if ("error" in result) setError(result.error);
      else router.refresh();
    });
  }

  function handleResetPassword() {
    setError(null);
    startTransition(async () => {
      const result = await resetStaffPassword(userId);
      if ("error" in result) setError(result.error);
      else if ("tempPassword" in result) setTempPassword(result.tempPassword);
    });
  }

  if (tempPassword) {
    return (
      <div className="text-xs">
        <p className="text-green-700">
          Nueva contraseña temporal:{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">
            {tempPassword}
          </code>
        </p>
        <button
          onClick={() => setTempPassword(null)}
          className="mt-1 text-slate-400 underline"
        >
          Cerrar
        </button>
      </div>
    );
  }

  if (isSelf) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <button
        onClick={handleToggleActive}
        disabled={pending}
        className="font-medium text-brand-700 hover:underline disabled:opacity-60"
      >
        {active ? "Suspender" : "Reactivar"}
      </button>
      <button
        onClick={handleResetPassword}
        disabled={pending}
        className="font-medium text-slate-600 hover:underline disabled:opacity-60"
      >
        Restablecer contraseña
      </button>
      <button
        onClick={handleDelete}
        disabled={pending}
        className="font-medium text-red-600 hover:underline disabled:opacity-60"
      >
        Eliminar
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
