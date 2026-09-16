import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Nominas({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    api
      .nominas(cuenta?.id)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  const contratos = data?.contratos || [];
  const resumenes = data?.resumenes || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle title="Nóminas" subtitle={`Contratos y periodos de ${cuenta?.displayName || "la cuenta seleccionada"}.`} className="mb-0" />
        {data && (
          <div className="flex gap-2">
            {data.soyEmpresa && <Badge tone="brand">Empresa</Badge>}
            {data.soyEmpleado && <Badge tone="green">Empleado</Badge>}
          </div>
        )}
      </div>

      {data?.periodo && (
        <Card>
          <p className="text-sm text-brand-dark/60">
            Periodo actual:{" "}
            <span className="font-bold text-brand-dark">{data.periodo}</span>
            {data.fechaLimite && (
              <>
                {" · "}Fecha límite{" "}
                <span className="font-bold text-brand-dark">{formatFecha(data.fechaLimite)}</span>
              </>
            )}
          </p>
        </Card>
      )}

      <Card>
        <SectionTitle title="Contratos" className="mb-3" />
        {!data && !err ? (
          <Skeleton className="h-24 w-full" />
        ) : err ? (
          <EmptyState title="No se pudieron cargar las nóminas" hint={err} />
        ) : contratos.length === 0 ? (
          <EmptyState title="Sin contratos de nómina" hint="No hay contratos activos a tu nombre." />
        ) : (
          <ul className="divide-y divide-brand/5">
            {contratos.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-dark">
                    {c.role || c.position || "Contrato"} · {c.employeeDip || c.placetaId || ""}
                  </p>
                  <p className="text-xs text-brand-dark/50">{c.employeeName || c.companyName || ""}</p>
                </div>
                <span className="text-sm font-extrabold text-brand">
                  {c.salaryPz != null ? formatPz(c.salaryPz) + " Pz" : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionTitle title="Resúmenes" className="mb-3" />
        {!data && !err ? (
          <Skeleton className="h-24 w-full" />
        ) : resumenes.length === 0 ? (
          <EmptyState title="Sin resúmenes" hint="Aún no hay periodos de nómina liquidados." />
        ) : (
          <ul className="divide-y divide-brand/5">
            {resumenes.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-brand-dark">
                    {r.periodo || r.mes || r.id}
                  </p>
                  <p className="text-xs text-brand-dark/50">
                    {r.contrato?.employeeDip || r.employeeDip || ""}
                  </p>
                </div>
                <span className="text-sm font-extrabold text-brand">
                  {formatPz(r.totalPz || r.netoPz || r.amountPz)} Pz
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
