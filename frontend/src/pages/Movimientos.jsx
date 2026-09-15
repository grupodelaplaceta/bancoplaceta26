import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Movimientos({ cuenta }) {
  const [movs, setMovs] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!cuenta) return;
    let alive = true;
    setMovs(null);
    api
      .movimientos(cuenta.id, 200)
      .then((r) => alive && setMovs(r.movimientos || []))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Movimientos"
        subtitle={`Historial completo de ${cuenta?.displayName || "tu cuenta"}.`}
      />

      <Card>
        {!movs && !err ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : err ? (
          <EmptyState title="No se pudieron cargar los movimientos" hint={err} />
        ) : movs.length === 0 ? (
          <EmptyState title="Sin movimientos" hint="Todavía no hay operaciones en esta cuenta." />
        ) : (
          <ul className="divide-y divide-brand/5">
            {movs.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-brand-dark">
                      {m.concept || m.kind}
                    </p>
                    <Badge tone={m.esEntrada ? "green" : "gray"}>{m.kind}</Badge>
                  </div>
                  <p className="text-xs text-brand-dark/50">{formatFecha(m.createdAt)}</p>
                </div>
                <span
                  className={
                    "whitespace-nowrap text-sm font-extrabold " +
                    (m.esEntrada ? "text-emerald-600" : "text-rose-500")
                  }
                >
                  {m.esEntrada ? "+" : "−"}
                  {formatPz(m.amountPz)} Pz
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
