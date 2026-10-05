// Aviso de privacidad — ruta pública (fuera de /dashboard, no requiere
// sesión; ver middleware.ts: su matcher es solo "/dashboard/:path*").
//
// IMPORTANTE: este es un BORRADOR. Quien legalmente responde por la
// exactitud de este documento es la clínica (el "responsable" de los
// datos bajo la LFPDPPP), no este sistema — por eso los datos propios
// de la clínica quedan marcados como huecos a llenar/confirmar en vez
// de inventados. Ver NEGOCIO.md sección 13 para el detalle completo de
// por qué se armó así.
//
// Contenido estático a propósito (no se jala de la base de datos): hoy
// solo hay una clínica piloto, y mezclar datos reales de la BD con
// huecos por completar haría más confuso revisarlo como un solo
// documento. Si el día de mañana hay varias clínicas con avisos
// distintos, esto se vuelve una plantilla por clínica.

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <mark className="rounded bg-amber-100 px-1 py-0.5 font-medium text-amber-900">
      {children}
    </mark>
  );
}

export default function AvisoDePrivacidadPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-sm leading-relaxed text-slate-700">
      <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
        <p className="font-semibold">Este documento es un borrador.</p>
        <p className="mt-1">
          Lo resaltado en amarillo son los datos propios de la clínica que
          hacen falta confirmar o completar antes de publicarlo como aviso
          oficial. El resto del texto ya está listo para revisión.
        </p>
      </div>

      <h1 className="mb-1 text-xl font-semibold text-slate-900">
        Aviso de Privacidad
      </h1>
      <p className="mb-8 text-xs text-slate-400">
        Última actualización: <Placeholder>[FECHA]</Placeholder>
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          1. Responsable del tratamiento de sus datos
        </h2>
        <p>
          <Placeholder>
            [NOMBRE COMPLETO O RAZÓN SOCIAL DE LA CLÍNICA]
          </Placeholder>
          , con domicilio en{" "}
          <Placeholder>[DOMICILIO COMPLETO DE LA CLÍNICA]</Placeholder>, es
          responsable del tratamiento de sus datos personales, incluidos sus
          datos de salud, de conformidad con la Ley Federal de Protección de
          Datos Personales en Posesión de los Particulares (LFPDPPP).
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          2. Datos personales que recabamos
        </h2>
        <p className="mb-2">Para brindarle atención médica, recabamos:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Datos de identificación y contacto: nombre completo, fecha de
            nacimiento, sexo, domicilio, teléfono, correo electrónico, CURP,
            estado civil, ocupación, contacto de emergencia y, de manera
            opcional, grupo étnico.
          </li>
          <li>
            <strong>Datos de salud</strong> (datos personales sensibles):
            antecedentes heredo-familiares y personales, alergias,
            padecimientos, signos vitales, diagnósticos, tratamientos y
            medicamentos recetados — es decir, el contenido de su historia
            clínica y de cada consulta.
          </li>
        </ul>
        <p className="mt-2">
          Al tratarse de datos sensibles, le pedimos su{" "}
          <strong>consentimiento expreso</strong> para recabarlos y usarlos,
          conforme al Artículo 9 de la LFPDPPP.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          3. Para qué usamos sus datos (finalidades)
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Brindarle atención médica y dar seguimiento a su historia clínica.</li>
          <li>Programar y gestionar sus citas.</li>
          <li>Elaborar recetas y documentos relacionados con su atención.</li>
          <li>
            Cumplir con las obligaciones de conservación y documentación que
            exige la normatividad sanitaria aplicable (NOM-004-SSA3-2012 y
            disposiciones relacionadas).
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          4. Cómo protegemos sus datos
        </h2>
        <p>
          Su expediente clínico se encuentra en un sistema con acceso
          restringido únicamente al personal de salud que lo atiende y al
          personal administrativo autorizado de la clínica, con medidas
          técnicas de seguridad (control de acceso por usuario,
          cifrado en tránsito) proporcionadas por nuestro proveedor de
          infraestructura. Dicho proveedor almacena la información en
          nuestro nombre, bajo instrucciones de la clínica, y no la utiliza
          para fines propios.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          5. Transferencia de sus datos
        </h2>
        <p>
          No compartimos sus datos personales con terceros, salvo que la ley
          nos obligue a ello (por ejemplo, requerimiento de autoridad
          competente) o usted lo autorice expresamente.
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          6. Sus derechos (ARCO) y cómo ejercerlos
        </h2>
        <p>
          Usted tiene derecho a Acceder, Rectificar y Cancelar sus datos
          personales, así como a Oponerse al uso de los mismos ("derechos
          ARCO"), y a revocar en cualquier momento el consentimiento que nos
          haya otorgado. Para ejercer estos derechos, o para cualquier duda
          sobre el tratamiento de sus datos, puede contactarnos en:{" "}
          <Placeholder>
            [CORREO O TELÉFONO PARA SOLICITUDES DE PRIVACIDAD]
          </Placeholder>
          .
        </p>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-base font-semibold text-slate-900">
          7. Cambios a este aviso de privacidad
        </h2>
        <p>
          Este aviso de privacidad puede actualizarse. Cualquier cambio será
          publicado en esta misma página, indicando la fecha de la última
          actualización.
        </p>
      </section>
    </div>
  );
}
