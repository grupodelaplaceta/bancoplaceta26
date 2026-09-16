import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge, Button } from "@/components/ui";
import { api, formatPz } from "@/lib/api";

export default function Facturacion({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [selected, setSelected] = useState([]);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState(null);
  const [paid, setPaid] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    setSelected([]);
    api
      .facturacion(cuenta?.id, mes)
      .then((r) => alive && setData(r))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta?.id, mes]);

  const empresas = data?.empresas || [];

  const toggleFactura = (id) => setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const pagarIva = async (emp) => {
    const facturaIds = selected.filter((id) => (emp.facturas || []).some((factura) => String(factura.id) === id));
    const from = emp.cuentas?.[0]?.id;
    if (!facturaIds.length || !from) return;
    setPaying(true);
    setPayError(null);
    setPaid(null);
    try {
      const result = await api.facturacionPagar({ from, mes, facturaIds });
      setPaid(result.pago || result);
      setSelected((items) => items.filter((id) => !facturaIds.includes(id)));
      const refreshed = await api.facturacion(cuenta?.id, mes);
      setData(refreshed);
    } catch (error) {
      setPayError(error.body?.error || error.message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="workspace-page space-y-6">
      <div className="workspace-heading">
        <SectionTitle title="Facturación" subtitle={`IVA y facturas de ${cuenta?.displayName || "la cuenta seleccionada"}.`} />
        <label className="month-picker">Mes<input type="month" value={mes} onChange={(event) => setMes(event.target.value)} /></label>
      </div>
      {payError && <div className="workspace-alert workspace-alert-error">{payError}</div>}
      {paid && <div className="workspace-alert workspace-alert-success">Pago de IVA solicitado correctamente{paid.executionCode ? ` · ${paid.executionCode}` : ""}.</div>}

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
                <div className="company-invoices">
                  <div className="company-invoices-heading"><span>Facturas del mes</span><span>{(emp.facturas || []).length} registradas</span></div>
                  {(emp.facturas || []).length === 0 ? <p className="text-sm text-brand-dark/55">No hay facturas de venta en este mes.</p> : (emp.facturas || []).map((factura) => {
                    const id = String(factura.id);
                    const pendiente = !factura.ivaPagado;
                    return <label key={id} className={`invoice-row ${pendiente ? "" : "invoice-row-paid"}`}>
                      <input type="checkbox" disabled={!pendiente} checked={selected.includes(id)} onChange={() => toggleFactura(id)} />
                      <span className="invoice-main"><strong>{factura.concepto || factura.id}</strong><small>{factura.fecha || "—"} · {factura.cliente || "Cliente"}</small></span>
                      <span className="invoice-amount">{formatPz(factura.iva || 0)} Pz IVA</span>
                      <Badge tone={pendiente ? "amber" : "green"}>{pendiente ? "Pendiente" : "Pagado"}</Badge>
                    </label>;
                  })}
                  <div className="company-invoices-actions">
                    <span>{selected.filter((id) => (emp.facturas || []).some((factura) => String(factura.id) === id)).length} seleccionadas</span>
                    <Button type="button" loading={paying} disabled={!selected.some((id) => (emp.facturas || []).some((factura) => String(factura.id) === id)) || !emp.cuentas?.length} onClick={() => pagarIva(emp)}>Pagar IVA seleccionado</Button>
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
