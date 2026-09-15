import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz } from "@/lib/api";

export default function Cumplimiento({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .cumplimiento(cuenta?.id)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Cumplimiento" subtitle="Estado de censo y verificación de tus cuentas." />

      <Card>
        {!data && !err ? (
          <Skeleton className="h-24 w-full" />
        ) : err ? (
          <EmptyState title="No se pudo cargar el cumplimiento" hint={err} />
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-brand-dark">Censo de tributos</span>
              <Badge tone={data.censado ? "green" : "amber"}>
                {data.censado ? "Censado" : "Pendiente"}
              </Badge>
            </div>

            {(data.cuentas || []).map((c) => (
              <div key={c.id} className="rounded-xl border border-brand/10 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-brand-dark">{c.displayName}</p>
                  <Badge tone={c.complianceStatus === "Clear" ? "green" : "amber"}>
                    {c.complianceStatus || "Clear"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-brand-dark/55">
                  <span>IRM: {c.irmOptIn ? "Activo" : "No"}</span>
                  <span>Justificación fondos: {c.fundsJustificationApproved ? "Aprobada" : "Pendiente"}</span>
                </div>
              </div>
            ))}

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-dark/50">Avisos</p>
              {(data.flags || []).length === 0 ? (
                <p className="text-sm text-brand-dark/55">No hay avisos pendientes. Todo en orden.</p>
              ) : (
                <ul className="space-y-2">
                  {(data.flags || []).map((f) => (
                    <li
                      key={f.id}
                      className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                    >
                      <span className="text-sm font-semibold text-amber-700">{f.reason || "Aviso"}</span>
                      <span className="text-sm font-bold text-amber-700">{formatPz(f.amountPz)} Pz</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
