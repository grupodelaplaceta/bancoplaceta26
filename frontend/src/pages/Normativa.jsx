import { Card, SectionTitle } from "@/components/ui";

const DOCS = [
  { codigo: "BCO-PRV-001", titulo: "Política de privacidad", desc: "Cómo tratamos tus datos personales." },
  { codigo: "BCO-TYC-001", titulo: "Términos y condiciones", desc: "Condiciones generales del Banco de La Placeta." },
  { codigo: "BCO-PZM-001", titulo: "Términos de uso de PlaceZUM", desc: "Normas del servicio de pago en un zum." },
];

export default function Normativa() {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="Normativa"
        subtitle="Documentos legales publicados en el Boletín Oficial de La Placeta (BOP)."
      />

      <Card>
        <ul className="divide-y divide-brand/5">
          {DOCS.map((d) => (
            <li key={d.codigo} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-brand-dark">{d.titulo}</p>
                <p className="text-xs text-brand-dark/55">{d.desc}</p>
              </div>
              <span className="whitespace-nowrap rounded-full bg-brand/10 px-3 py-1 font-mono text-xs font-bold text-brand">
                {d.codigo}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-brand/5 p-4 text-sm text-brand-dark/60">
          Banco de La Placeta es la primera economía virtual sin ánimo de lucro que unifica
          proyectos y una comunidad. Si eres menor de 16 años, utiliza{" "}
          <span className="font-bold text-brand">Placeta Junior</span>.
        </p>
      </Card>
    </div>
  );
}
