import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Tributos({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .tributos(cuenta?.id)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  const propias = data?.declaraciones || [];
  const empresas = data?.empresas || [];
  const total = propias.length + empresas.reduce((n, e) => n + (e.declaraciones?.length || 0), 0);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Tributos"
        subtitle="Tus declaraciones tributarias (IRM/IGF) y las de tus empresas."
      />

      <Card>
        {!data && !err ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : err ? (
          <EmptyState title="No se pudieron cargar los tributos" hint={err} />
        ) : total === 0 ? (
          <EmptyState
            title="Sin declaraciones"
            hint="Cuando se emita una declaración a tu nombre o al de tu empresa, aparecerá aquí."
          />
        ) : (
          <div className="space-y-5">
            {propias.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-dark/50">A tu nombre</p>
                <ul className="divide-y divide-brand/5">
                  {propias.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-brand-dark">{d.tipo || d.kind || d.id}</p>
                        <p className="text-xs text-brand-dark/50">{formatFecha(d.emision || d.createdAt || d.periodo)}</p>
                      </div>
                      <Badge tone="brand">{d.estado || d.status || "—"}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {empresas.map((emp) => (
              <div key={emp.eip}>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand-dark/50">
                  {emp.nombre || emp.eip}
                </p>
                <ul className="divide-y divide-brand/5">
                  {(emp.declaraciones || []).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="text-sm font-semibold text-brand-dark">{d.tipo || d.kind || d.id}</p>
                        <p className="text-xs text-brand-dark/50">{formatFecha(d.emision || d.createdAt)}</p>
                      </div>
                      <span className="text-sm font-extrabold text-brand">
                        {d.totalPz != null ? formatPz(d.totalPz) + " Pz" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
