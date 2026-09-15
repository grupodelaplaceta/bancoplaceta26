import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api } from "@/lib/api";

export default function Gestores() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .gestores()
      .then((r) => alive && setData(r.gestores || []))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <SectionTitle title="Gestores y cotitulares" subtitle="Personas con acceso a tus cuentas." />

      <Card>
        {!data && !err ? (
          <Skeleton className="h-24 w-full" />
        ) : err ? (
          <EmptyState title="No se pudieron cargar los gestores" hint={err} />
        ) : data.length === 0 ? (
          <EmptyState title="Sin gestores" hint="No hay cotitulares ni gestores en tus cuentas." />
        ) : (
          <ul className="divide-y divide-brand/5">
            {data.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/10 text-sm font-extrabold text-brand">
                    {(g.displayName || g.placetaId || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-dark">{g.displayName || g.placetaId}</p>
                    <p className="text-xs text-brand-dark/50">{g.placetaId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge tone="brand">{g.role}</Badge>
                  {g.ownershipPercent > 0 && (
                    <p className="mt-1 text-xs text-brand-dark/50">{g.ownershipPercent}%</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
