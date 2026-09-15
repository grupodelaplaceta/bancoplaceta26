import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz } from "@/lib/api";

export default function Facturacion() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .facturacion()
      .then((r) => alive && setData(r))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const empresas = data?.empresas || [];

  return (
    <div className="space-y-6">
      <SectionTitle title="Facturación" subtitle="Facturas e IVA de tus empresas." />

      <Card>
        {!data && !err ? (
          <Skeleton className="h-24 w-full" />
        ) : err ? (
          <EmptyState title="No se pudieron cargar las facturas" hint={err} />
        ) : empresas.length === 0 ? (
          <EmptyState title="Sin empresas" hint="No gestionas empresas con facturación activa." />
        ) : (
          <div className="space-y-5">
            {empresas.map((emp) => (
              <div key={emp.eip} className="rounded-xl border border-brand/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-brand-dark">{emp.nombre || emp.eip}</p>
                  <Badge tone="brand">{emp.eip}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-brand-dark/50">Total facturas</p>
                    <p className="text-sm font-extrabold text-brand-dark">{formatPz(emp.totalFacturas)} Pz</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-dark/50">IVA ventas</p>
                    <p className="text-sm font-extrabold text-brand-dark">{formatPz(emp.totalIvaVentas)} Pz</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-dark/50">IVA pagado</p>
                    <p className="text-sm font-extrabold text-brand-dark">{formatPz(emp.totalIvaPagado)} Pz</p>
                  </div>
                  <div>
                    <p className="text-xs text-brand-dark/50">IVA pendiente</p>
                    <p className={"text-sm font-extrabold " + (emp.ivaPendiente > 0 ? "text-rose-500" : "text-emerald-600")}>
                      {formatPz(emp.ivaPendiente)} Pz
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
