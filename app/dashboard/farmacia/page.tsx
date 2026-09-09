import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PharmacyCatalog from "./PharmacyCatalog";
import PharmacyMovements from "./PharmacyMovements";

export default async function FarmaciaPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("clinic_id, is_admin, is_pharmacy, active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.active || !(profile.is_admin || profile.is_pharmacy)) {
    redirect("/dashboard/citas");
  }

  const { data: itemRows } = await supabase
    .from("pharmacy_items")
    .select("id, name, box_description, active")
    .order("name");

  const { data: movementRows } = await supabase
    .from("pharmacy_movements")
    .select(
      "id, item_id, movement_type, quantity_boxes, notes, created_at, pharmacy_items(name), patients(full_name), users(full_name)"
    )
    .order("created_at", { ascending: false });

  const stockByItem = new Map<string, number>();
  for (const mv of movementRows ?? []) {
    const delta =
      mv.movement_type === "entrada" ? mv.quantity_boxes : -mv.quantity_boxes;
    stockByItem.set(mv.item_id, (stockByItem.get(mv.item_id) ?? 0) + delta);
  }

  const items = (itemRows ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    boxDescription: item.box_description,
    active: item.active,
    currentStockBoxes: stockByItem.get(item.id) ?? 0,
  }));

  const movements = (movementRows ?? []).map((mv) => ({
    id: mv.id,
    itemName: (mv.pharmacy_items as any)?.name ?? "—",
    movementType: mv.movement_type as "entrada" | "salida",
    quantityBoxes: mv.quantity_boxes,
    patientName: (mv.patients as any)?.full_name ?? null,
    registeredBy: (mv.users as any)?.full_name ?? "—",
    notes: mv.notes,
    createdAt: mv.created_at,
  }));

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Farmacia</h1>
      <p className="mb-6 text-sm text-slate-500">
        Catálogo de medicamentos, entradas/salidas y stock por caja.
      </p>

      <PharmacyCatalog clinicId={profile.clinic_id} items={items} />

      <div className="mt-8">
        <PharmacyMovements movements={movements} />
      </div>
    </div>
  );
}
