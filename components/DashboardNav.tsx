"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardNav({
  isAdmin,
  canAccessPharmacy,
}: {
  isAdmin: boolean;
  canAccessPharmacy: boolean;
}) {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard/citas", label: "Inicio" },
    { href: "/dashboard/pacientes", label: "Pacientes" },
    ...(canAccessPharmacy
      ? [{ href: "/dashboard/farmacia", label: "Farmacia" }]
      : []),
    ...(isAdmin ? [{ href: "/dashboard/usuarios", label: "Usuarios" }] : []),
  ];

  return (
    <aside className="print:hidden w-60 shrink-0 border-r border-slate-200 bg-white p-6">
      <nav className="space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
              pathname === link.href
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
