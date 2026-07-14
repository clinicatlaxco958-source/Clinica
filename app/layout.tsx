import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicSaaS — Agenda para clínicas",
  description: "Administra citas y pacientes sin papel ni Excel.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
