import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

const ESTADOS = {
  aprobada: "green",
  concedida: "green",
  pagada: "green",
  pendiente: "amber",
  solicitada: "amber",
  rechazada: "rose",
  denegada: "rose",
};

export default function Subvenciones({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .subvenciones(cuenta?.id)
      .then((r) => alive && setData(r.solicitudes || []))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Subvenciones"
        subtitle="Solicitudes recibidas por tus cuentas desde el ecosistema."
      />

      <Card>
        {!data && !err ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : err ? (
          <EmptyState title="No se pudieron cargar las subvenciones" hint={err} />
        ) : data.length === 0 ? (
          <EmptyState
            title="Sin subvenciones"
            hint="Cuando una entidad te conceda una subvención, aparecerá aquí."
          />
        ) : (
          <ul className="divide-y divide-brand/5">
            {data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-brand-dark">
                    {s.concept || s.title || s.motivo || "Subvención"}
                  </p>
                  <p className="text-xs text-brand-dark/50">
                    {s.emisor || s.fromDisplayName || s.entityName || "Entidad"} ·{" "}
                    {formatFecha(s.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold text-brand">
                    {formatPz(s.amountPz || s.importePz)} Pz
                  </span>
                  <Badge tone={ESTADOS[String(s.status || s.estado || "").toLowerCase()] || "gray"}>
                    {s.status || s.estado || "—"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
