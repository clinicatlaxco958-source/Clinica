import { formatDose, type MedicationRow } from "@/lib/prescription";

export default function PrescriptionSheet({
  doctorName,
  doctorSpecialty,
  doctorUniversity,
  doctorLicenseNumber,
  doctorLogoUrl,
  doctorWatermarkUrl,
  clinicName,
  clinicAddress,
  clinicPhone,
  patientName,
  patientAge,
  today,
  vitals,
  medications,
  footerLabel,
  className,
}: {
  doctorName: string;
  doctorSpecialty: string | null;
  doctorUniversity: string | null;
  doctorLicenseNumber: string | null;
  doctorLogoUrl: string | null;
  doctorWatermarkUrl: string | null;
  clinicName: string;
  clinicAddress: string | null;
  clinicPhone: string | null;
  patientName: string;
  patientAge: number | null;
  today: string;
  vitals: string[];
  medications: MedicationRow[];
  footerLabel?: string;
  className: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 text-sm print:rounded-none print:border-0 print:p-0 ${className}`}
    >
      {doctorWatermarkUrl && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={doctorWatermarkUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 m-auto h-2/3 max-h-72 w-2/3 max-w-xs select-none object-contain opacity-10"
        />
      )}

      <div className="relative z-10 flex flex-1 flex-col">
        {/* Header doctor */}
        <div className="flex items-start gap-4 rounded-lg bg-gradient-to-r from-slate-100 via-slate-50 to-white p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center">
            {doctorLogoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={doctorLogoUrl}
                alt="Logo"
                className="h-full w-full object-contain"
              />
            ) : null}
          </div>
          <div className="flex-1 text-center">
            {doctorUniversity && (
              <p className="text-xs text-slate-600">{doctorUniversity}</p>
            )}
            <p className="text-base font-semibold text-slate-900">
              {doctorName}
            </p>
            {doctorSpecialty && (
              <p className="text-xs text-slate-600">{doctorSpecialty}</p>
            )}
            {doctorLicenseNumber && (
              <p className="text-[11px] text-slate-500">
                Cédula profesional: {doctorLicenseNumber}
              </p>
            )}
          </div>
        </div>

        {/* Cuerpo */}
        <div className="mt-4 flex-1 grid grid-cols-[130px_1fr] gap-4">
          {/* Franja izquierda */}
          <div className="flex flex-col justify-between border-r border-slate-200 pr-3 text-xs text-slate-600">
            <div>
              <div>
                <p className="font-medium text-slate-800">Fecha</p>
                <p>{today}</p>
              </div>

              <div className="mt-3 border-t border-slate-200 pt-3">
                <p className="mb-1 font-medium text-slate-800">
                  Signos vitales
                </p>
                {vitals.length === 0 ? (
                  <p className="text-slate-400">—</p>
                ) : (
                  vitals.map((v) => <p key={v}>{v}</p>)
                )}
              </div>
            </div>

            <div>
              {clinicName && (
                <p className="font-medium text-slate-800">{clinicName}</p>
              )}
              {clinicAddress && <p>{clinicAddress}</p>}
              {clinicPhone && <p>Tel: {clinicPhone}</p>}
            </div>
          </div>

          {/* Área principal */}
          <div className="flex flex-col">
            <div className="mb-3 flex justify-between text-xs text-slate-700">
              <p>
                <span className="font-medium text-slate-800">Paciente:</span>{" "}
                {patientName}
              </p>
              <p>
                <span className="font-medium text-slate-800">Edad:</span>{" "}
                {patientAge != null ? `${patientAge} años` : "—"}
              </p>
            </div>

            <div className="flex-1 space-y-2 text-xs text-slate-700">
              {medications.length === 0 ? (
                <p className="text-slate-400">
                  Sin medicamentos agregados todavía.
                </p>
              ) : (
                medications.map((m, i) => (
                  <p key={i}>
                    {i + 1}. <strong>{m.medicationName}</strong> —{" "}
                    {formatDose(m)} cada {m.frequencyHours} hrs por{" "}
                    {m.durationDays} {m.durationDays === "1" ? "día" : "días"}
                  </p>
                ))
              )}
            </div>

            <div className="mt-8 flex justify-end">
              <div className="w-40 text-center">
                <div className="border-t border-slate-400 pt-1 text-[11px] text-slate-500">
                  Firma
                </div>
              </div>
            </div>
          </div>
        </div>

        {footerLabel && (
          <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-slate-400">
            {footerLabel}
          </p>
        )}
      </div>
    </div>
  );
}
