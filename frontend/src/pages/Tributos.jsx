import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Tributos({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [baseSimulada, setBaseSimulada] = useState("");
  const [tipoSimulado, setTipoSimulado] = useState("10");

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

      {data?.estimacion && <Card className="tax-estimator-card">
        <div className="tax-estimator-heading"><div><p className="eyebrow">Cálculo real</p><h3>Estimación del periodo {data.estimacion.periodo}</h3><p>Calculada con saldos y movimientos liquidados; no modifica tu declaración.</p></div><span aria-hidden="true">✓</span></div>
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-brand-dark/50">IRM</span><strong className="block">{formatPz(data.estimacion.cuotaIrm)} Pz</strong></div><div><span className="text-brand-dark/50">IGF</span><strong className="block">{formatPz(data.estimacion.cuotaIgf)} Pz</strong></div><div><span className="text-brand-dark/50">IVA repercutido</span><strong className="block">{formatPz(data.estimacion.ivaRepercutido)} Pz</strong></div><div><span className="text-brand-dark/50">Total estimado</span><strong className="block text-brand">{formatPz(data.estimacion.total)} Pz</strong></div></div>
      </Card>}

      <Card className="tax-estimator-card">
        <div className="tax-estimator-heading"><div><p className="eyebrow">Simulador orientativo</p><h3>Estimación de tributo</h3><p>Calcula una referencia sin modificar declaraciones ni saldos.</p></div><span aria-hidden="true">≈</span></div>
        <div className="tax-estimator-fields"><label>Base estimada (Pz)<input type="number" min="0" inputMode="decimal" value={baseSimulada} onChange={(event) => setBaseSimulada(event.target.value)} placeholder="0" /></label><label>Tipo orientativo<input type="number" min="0" max="100" step="0.1" value={tipoSimulado} onChange={(event) => setTipoSimulado(event.target.value)} /></label></div>
        <div className="tax-estimator-result"><span>Simulación manual</span><strong>{formatPz((Number(baseSimulada) || 0) * (Number(tipoSimulado) || 0) / 100)} Pz</strong><small>Simulación manual; el cálculo real del periodo aparece arriba.</small></div>
      </Card>

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
