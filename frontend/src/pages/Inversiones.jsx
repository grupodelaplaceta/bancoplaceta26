import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Inversiones({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    api
      .inversiones(cuenta?.id)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  const holdings = data?.holdings || [];
  const operaciones = data?.operaciones || [];

  return (
    <div className="workspace-page space-y-6">
      <SectionTitle title="Inversiones" subtitle={`Cartera de ${cuenta?.displayName || "la cuenta seleccionada"}.`} />

      <div className="workspace-summary-grid">
        <div className="workspace-summary workspace-summary-primary"><span>Posiciones</span><strong>{holdings.length}</strong><small>Activos en cartera</small></div>
        <div className="workspace-summary"><span>Operaciones</span><strong>{operaciones.length}</strong><small>Movimientos de inversión</small></div>
      </div>

      <Card className="responsive-card">
        <SectionTitle title="Posiciones" className="mb-3" />
        {!data && !err ? (
          <Skeleton className="h-24 w-full" />
        ) : err ? (
          <EmptyState title="No se pudieron cargar las inversiones" hint={err} />
        ) : holdings.length === 0 ? (
          <EmptyState title="Sin posiciones" hint="Todavía no tienes activos en cartera." />
        ) : (
          <ul className="divide-y divide-brand/5">
            {holdings.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="truncate text-sm font-semibold text-brand-dark">{h.assetName || h.name || h.asset || h.id}</p>
                  <p className="text-xs text-brand-dark/50">{h.symbol || `${h.units ?? 0} unidades`}</p>
                </div>
                <span className="whitespace-nowrap text-right text-sm font-extrabold text-brand">
                  {h.currentValuePz != null ? `${formatPz(h.currentValuePz)} Pz` : h.units != null ? `${formatPz(h.units)} uds.` : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle title="Operaciones" className="mb-3" />
        {!data && !err ? (
          <Skeleton className="h-24 w-full" />
        ) : operaciones.length === 0 ? (
          <EmptyState title="Sin operaciones" hint="Aquí verás tus compras y ventas de activos." />
        ) : (
          <ul className="divide-y divide-brand/5">
            {operaciones.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="truncate text-sm font-semibold text-brand-dark">{o.assetName || o.kind || o.type || "Operación"}</p>
                  <p className="text-xs text-brand-dark/50">{formatFecha(o.createdAt)} · {o.settledAt ? "Liquidada" : "Pendiente"}</p>
                </div>
                <span className="whitespace-nowrap text-right text-sm font-extrabold text-brand">
                  {o.amountPz != null ? formatPz(o.amountPz) + " Pz" : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
