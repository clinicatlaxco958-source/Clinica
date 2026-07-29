"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

type Tab = "ajustes" | "receta" | "informacion";

const TABS: { id: Tab; label: string }[] = [
  { id: "ajustes", label: "Ajustes" },
  { id: "receta", label: "Receta" },
  { id: "informacion", label: "Información" },
];

export default function DoctorSettingsForm({
  doctorId,
  initialSpecialty,
  initialDuration,
  initialWorkStart,
  initialWorkEnd,
  initialUniversity,
  initialLicenseNumber,
  initialLogoUrl,
  initialWatermarkUrl,
  clinicDefaultDuration,
  clinicDefaultWorkStart,
  clinicDefaultWorkEnd,
  fullName,
  email,
  clinicName,
  roleLabel,
  isAdmin,
}: {
  doctorId: string;
  initialSpecialty: string | null;
  initialDuration: number | null;
  initialWorkStart: string | null;
  initialWorkEnd: string | null;
  initialUniversity: string | null;
  initialLicenseNumber: string | null;
  initialLogoUrl: string | null;
  initialWatermarkUrl: string | null;
  clinicDefaultDuration: number;
  clinicDefaultWorkStart: string;
  clinicDefaultWorkEnd: string;
  fullName: string;
  email: string;
  clinicName: string;
  roleLabel: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>("ajustes");
  const [specialty, setSpecialty] = useState(initialSpecialty ?? "");
  const [duration, setDuration] = useState(
    initialDuration != null ? String(initialDuration) : ""
  );
  const [workStart, setWorkStart] = useState(
    initialWorkStart?.slice(0, 5) ?? ""
  );
  const [workEnd, setWorkEnd] = useState(initialWorkEnd?.slice(0, 5) ?? "");
  const [university, setUniversity] = useState(initialUniversity ?? "");
  const [licenseNumber, setLicenseNumber] = useState(
    initialLicenseNumber ?? ""
  );
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [watermarkUrl, setWatermarkUrl] = useState(initialWatermarkUrl ?? "");
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkError, setWatermarkError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function validateImage(file: File): string | null {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return "Formato no soportado. Usa PNG, JPG o WEBP.";
    }
    if (file.size > MAX_LOGO_BYTES) {
      return "La imagen debe pesar menos de 2MB.";
    }
    return null;
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoError(null);
    if (!file) {
      setLogoFile(null);
      return;
    }
    const validationError = validateImage(file);
    if (validationError) {
      setLogoError(validationError);
      e.target.value = "";
      return;
    }
    setLogoFile(file);
    setLogoUrl(URL.createObjectURL(file));
  }

  function handleWatermarkChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setWatermarkError(null);
    if (!file) {
      setWatermarkFile(null);
      return;
    }
    const validationError = validateImage(file);
    if (validationError) {
      setWatermarkError(validationError);
      e.target.value = "";
      return;
    }
    setWatermarkFile(file);
    setWatermarkUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const durationValue = duration.trim() ? Number(duration) : null;
    if (
      durationValue !== null &&
      (!Number.isInteger(durationValue) || durationValue <= 0)
    ) {
      setError("La duración debe ser un número entero positivo.");
      return;
    }

    if (workStart && workEnd && workStart >= workEnd) {
      setError("La hora de inicio debe ser antes que la hora de fin.");
      return;
    }

    setSaving(true);

    let uploadedLogoUrl: string | null = null;
    let uploadedWatermarkUrl: string | null = null;
    if (logoFile || watermarkFile) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Query param de cache-busting: la ruta en Storage es fija
      // (`{uid}/logo.<ext>`), así que si se sube un archivo con la misma
      // extensión que antes, la URL pública queda idéntica y el navegador
      // (y el caché de Storage) sirve la imagen vieja aunque el archivo ya
      // se haya reemplazado en el servidor.
      const cacheBust = Date.now();

      if (user) {
        if (logoFile) {
          const ext = logoFile.name.split(".").pop() ?? "png";
          const path = `${user.id}/logo.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("doctor-logos")
            .upload(path, logoFile, { upsert: true });

          if (uploadError) {
            setLogoError(
              `No se pudo subir el logo: ${uploadError.message}. Se guardó el resto de los cambios.`
            );
          } else {
            const {
              data: { publicUrl },
            } = supabase.storage.from("doctor-logos").getPublicUrl(path);
            uploadedLogoUrl = `${publicUrl}?v=${cacheBust}`;
          }
        }

        if (watermarkFile) {
          const ext = watermarkFile.name.split(".").pop() ?? "png";
          const path = `${user.id}/watermark.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from("doctor-logos")
            .upload(path, watermarkFile, { upsert: true });

          if (uploadError) {
            setWatermarkError(
              `No se pudo subir la marca de agua: ${uploadError.message}. Se guardó el resto de los cambios.`
            );
          } else {
            const {
              data: { publicUrl },
            } = supabase.storage.from("doctor-logos").getPublicUrl(path);
            uploadedWatermarkUrl = `${publicUrl}?v=${cacheBust}`;
          }
        }
      }
    }

    const { error: updateError } = await supabase
      .from("doctors")
      .update({
        specialty: specialty.trim() || null,
        default_duration_minutes: durationValue,
        work_start_time: workStart || null,
        work_end_time: workEnd || null,
        university: university.trim() || null,
        license_number: licenseNumber.trim() || null,
        ...(uploadedLogoUrl ? { logo_url: uploadedLogoUrl } : {}),
        ...(uploadedWatermarkUrl ? { watermark_url: uploadedWatermarkUrl } : {}),
      })
      .eq("id", doctorId);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setLogoFile(null);
    setWatermarkFile(null);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="text-sm">
      <div className="flex border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px border-b-2 px-3 pb-3 text-sm font-medium ${
              activeTab === tab.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-md space-y-4 pt-6">
        {activeTab === "ajustes" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Especialidad
              </label>
              <input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Duración estándar de consulta (min)
              </label>
              <input
                type="number"
                min={1}
                placeholder={`Default de la clínica: ${clinicDefaultDuration}`}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">
                Se usa para calcular la hora de fin al agendar tus citas.
                Déjalo vacío para usar el default de la clínica (
                {clinicDefaultDuration} min).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Inicio de jornada
                </label>
                <input
                  type="time"
                  placeholder={clinicDefaultWorkStart}
                  value={workStart}
                  onChange={(e) => setWorkStart(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Fin de jornada
                </label>
                <input
                  type="time"
                  placeholder={clinicDefaultWorkEnd}
                  value={workEnd}
                  onChange={(e) => setWorkEnd(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-slate-500">
              Define los horarios válidos que se ofrecen al agendar tus
              citas. Déjalos vacíos para usar el default de la clínica (
              {clinicDefaultWorkStart}–{clinicDefaultWorkEnd}).
            </p>
          </>
        )}

        {activeTab === "receta" && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Universidad
              </label>
              <input
                placeholder="Universidad donde te graduaste"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Cédula profesional
              </label>
              <input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Logo
              </label>
              {logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="mb-2 h-16 w-16 rounded-lg border border-slate-200 object-contain"
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoChange}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="mt-1 text-xs text-slate-500">
                PNG, JPG o WEBP, máximo 2MB.
              </p>
              {logoError && (
                <p className="mt-1 text-sm text-red-600">{logoError}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Marca de agua
              </label>
              {watermarkUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={watermarkUrl}
                  alt="Marca de agua"
                  className="mb-2 h-16 w-16 rounded-lg border border-slate-200 object-contain"
                />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleWatermarkChange}
                className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              <p className="mt-1 text-xs text-slate-500">
                Se muestra de fondo, semitransparente, en toda la hoja de la
                receta. PNG, JPG o WEBP, máximo 2MB.
              </p>
              {watermarkError && (
                <p className="mt-1 text-sm text-red-600">{watermarkError}</p>
              )}
            </div>
          </>
        )}

        {activeTab === "informacion" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase text-slate-400">Nombre</p>
              <p className="text-slate-700">{fullName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Correo</p>
              <p className="text-slate-700">{email}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Clínica</p>
              <p className="text-slate-700">{clinicName}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Función</p>
              <p className="text-slate-700">{roleLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Permisos</p>
              <p className="text-slate-700">
                {isAdmin ? "Administrador" : "Staff"}
              </p>
            </div>
          </div>
        )}

        {activeTab !== "informacion" && (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && !error && (
              <p className="text-sm text-green-700">Guardado.</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
