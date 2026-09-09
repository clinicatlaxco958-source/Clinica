"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AddMedicationModal from "./AddMedicationModal";
import MovementModal from "./MovementModal";

type PharmacyItem = {
  id: string;
  name: string;
  boxDescription: string | null;
  active: boolean;
  currentStockBoxes: number;
};

export default function PharmacyCatalog({
  clinicId,
  items,
}: {
  clinicId: string;
  items: PharmacyItem[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [addOpen, setAddOpen] = useState(false);
  const [movement, setMovement] = useState<{
    mode: "entrada" | "salida";
    item: PharmacyItem;
  } | null>(null);

  async function toggleActive(item: PharmacyItem) {
    await supabase
      .from("pharmacy_items")
      .update({ active: !item.active })
      .eq("id", item.id);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Catálogo</h2>
        <button
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Agregar medicamento
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Medicamento</th>
              <th className="px-4 py-3">Caja</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length > 0 ? (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {item.name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.boxDescription ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {item.currentStockBoxes} caja
                    {item.currentStockBoxes === 1 ? "" : "s"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        item.active
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.active ? "Activo" : "Descontinuado"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <button
                        onClick={() => setMovement({ mode: "entrada", item })}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        Registrar entrada
                      </button>
                      <button
                        onClick={() => setMovement({ mode: "salida", item })}
                        disabled={item.currentStockBoxes <= 0}
                        className="font-medium text-slate-600 hover:underline disabled:opacity-40"
                      >
                        Registrar salida
                      </button>
                      <button
                        onClick={() => toggleActive(item)}
                        className="font-medium text-slate-400 hover:underline"
                      >
                        {item.active ? "Descontinuar" : "Reactivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-slate-400"
                >
                  No hay medicamentos en el catálogo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddMedicationModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => router.refresh()}
        clinicId={clinicId}
      />

      {movement && (
        <MovementModal
          open={!!movement}
          onClose={() => setMovement(null)}
          onCreated={() => router.refresh()}
          mode={movement.mode}
          item={movement.item}
          clinicId={clinicId}
        />
      )}
    </div>
  );
}
