"use client";

import { useMemo, useState } from "react";

type Movement = {
  id: string;
  itemName: string;
  movementType: "entrada" | "salida";
  quantityBoxes: number;
  patientName: string | null;
  registeredBy: string;
  notes: string | null;
  createdAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function PharmacyMovements({
  movements,
}: {
  movements: Movement[];
}) {
  const [itemFilter, setItemFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const itemNames = useMemo(
    () => Array.from(new Set(movements.map((m) => m.itemName))).sort(),
    [movements]
  );

  const filtered = movements.filter((m) => {
    if (itemFilter && m.itemName !== itemFilter) return false;
    const day = m.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <h2 className="mr-auto text-sm font-semibold text-slate-900">
          Movimientos
        </h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Medicamento
          </label>
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {itemNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Desde
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Hasta
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Medicamento</th>
              <th className="px-4 py-3">Cajas</th>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Registró</th>
              <th className="px-4 py-3">Nota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length > 0 ? (
              filtered.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 text-slate-500">
                    {formatDate(m.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        m.movementType === "entrada"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {m.movementType === "entrada" ? "Entrada" : "Salida"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {m.itemName}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {m.quantityBoxes}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {m.patientName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {m.registeredBy}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {m.notes ?? "—"}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  No hay movimientos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
