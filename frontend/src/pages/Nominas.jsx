import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Nominas({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({ employeeDip: "", employeeName: "", employeeAccountId: "", roleTitle: "Trabajador", grossSalaryPz: "200", startDate: new Date().toISOString().slice(0, 10), frequency: "Weekly", complementos: [] });
  const [contactos, setContactos] = useState([]);
  const [complemento, setComplemento] = useState({ concepto: "", importePz: "", tipo: "cargo", periodicidad: "mensual" });
  const [buscandoTrabajador, setBuscandoTrabajador] = useState(false);
  const [busquedaError, setBusquedaError] = useState(null);
  const [expandedContractId, setExpandedContractId] = useState(null);
  const [endingId, setEndingId] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);
    Promise.all([api.nominas(cuenta?.id), api.contactos(cuenta?.id)])
      .then(([nominas, contactosResponse]) => {
        if (!alive) return;
        setData(nominas);
        setContactos((contactosResponse.contactos || []).filter((contacto) => contacto.type === "Current"));
      })
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  const contratos = data?.contratos || [];
  const resumenes = data?.resumenes || [];
  const periodos = data?.periodos || [];
  const esEmpresa = ["business", "empresa"].includes(String(cuenta?.type || "").toLowerCase());
  const proximoPago = (contract) => {
    const dias = contract.frequency === "Monthly" ? 30 : contract.frequency === "Biweekly" ? 14 : 7;
    const fecha = new Date(Date.now() + dias * 86400000);
    const fijos = (contract.complementos || []).filter((item) => item.tipo !== "actividad" && item.activo !== false).reduce((total, item) => total + (Number(item.importePz) || 0) / (item.periodicidad === "anual" ? 12 : 1), 0);
    const bruto = Number(contract.grossSalaryPz || 0) + fijos;
    const retencion = bruto * Number(data?.config?.retencionPct || 0) / 100;
    return { fecha, bruto, neto: bruto - retencion };
  };
  const costeProximosPagos = contratos.filter((contract) => contract.status !== "Ended").reduce((total, contract) => total + proximoPago(contract).bruto, 0);

  const buscarTrabajador = async () => {
    setBusquedaError(null);
    setBuscandoTrabajador(true);
    try {
      const result = await api.buscarTrabajador(form.employeeDip);
      const cuentaEncontrada = result.cuentas?.[0];
      if (!cuentaEncontrada) throw new Error("No se ha encontrado una cuenta corriente para ese DIP");
      setForm({ ...form, employeeAccountId: cuentaEncontrada.id, employeeDip: cuentaEncontrada.employeeDip, employeeName: cuentaEncontrada.displayName });
    } catch (error) {
      setBusquedaError(error.message);
    } finally {
      setBuscandoTrabajador(false);
    }
  };

  const despedirTrabajador = async (contract) => {
    if (!window.confirm(`¿Finalizar el contrato de ${contract.employeeName || contract.employeeDip}?`)) return;
    setEndingId(contract.id);
    try {
      await api.despedirTrabajador(contract.id);
      const actualizado = await api.nominas(cuenta.id);
      setData(actualizado);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setEndingId(null);
    }
  };

  const altaTrabajador = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await api.altaTrabajador({ ...form, companyAccountId: cuenta.id, grossSalaryPz: Number(form.grossSalaryPz) });
      const actualizado = await api.nominas(cuenta.id);
      setData(actualizado);
      setForm({ employeeDip: "", employeeName: "", employeeAccountId: "", roleTitle: "Trabajador", grossSalaryPz: "200", startDate: new Date().toISOString().slice(0, 10), frequency: "Weekly", complementos: [] });
      setComplemento({ concepto: "", importePz: "", tipo: "cargo", periodicidad: "mensual" });
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

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

      {esEmpresa && (
        <Card>
          <SectionTitle title="Dar de alta trabajador" subtitle="La nómina se asociará a esta cuenta bancaria y a su EIP." className="mb-3" />
          <form onSubmit={altaTrabajador} className="grid gap-3 md:grid-cols-2">
            <select value={form.employeeAccountId} onChange={(e) => {
              const contact = contactos.find((item) => item.accountId === e.target.value);
              setForm({ ...form, employeeAccountId: e.target.value, employeeDip: contact?.employeeDip || "", employeeName: contact?.displayName || "" });
            }} className="rounded-xl border border-brand/15 bg-white px-3 py-2 text-sm md:col-span-2">
              <option value="">Selecciona un trabajador/contacto guardado</option>
              {contactos.map((contacto) => <option key={contacto.accountId} value={contacto.accountId}>{contacto.displayName} · {contacto.employeeDip}</option>)}
            </select>
            <div className="flex gap-2 md:col-span-2">
              <input required placeholder="DIP trabajador" value={form.employeeDip} onChange={(e) => setForm({ ...form, employeeDip: e.target.value.toUpperCase(), employeeAccountId: "", employeeName: "" })} className="min-w-0 flex-1 rounded-xl border border-brand/15 px-3 py-2 text-sm" />
              <button type="button" disabled={buscandoTrabajador || !form.employeeDip} onClick={buscarTrabajador} className="rounded-xl bg-brand/10 px-3 py-2 text-sm font-bold text-brand disabled:opacity-50">{buscandoTrabajador ? "Buscando…" : "Buscar DIP"}</button>
            </div>
            <input required placeholder="Nombre del trabajador" value={form.employeeName} readOnly className="rounded-xl border border-brand/15 bg-brand/5 px-3 py-2 text-sm" />
            {busquedaError && <p className="text-sm text-red-600 md:col-span-2">{busquedaError}</p>}
            <input required placeholder="Puesto / función" value={form.roleTitle} onChange={(e) => setForm({ ...form, roleTitle: e.target.value })} className="rounded-xl border border-brand/15 px-3 py-2 text-sm" />
            <input required min="0" type="number" placeholder="Salario bruto Pz" value={form.grossSalaryPz} onChange={(e) => setForm({ ...form, grossSalaryPz: e.target.value })} className="rounded-xl border border-brand/15 px-3 py-2 text-sm" />
            <input required type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="rounded-xl border border-brand/15 px-3 py-2 text-sm" />
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="rounded-xl border border-brand/15 bg-white px-3 py-2 text-sm">
              <option value="Weekly">Semanal</option><option value="Biweekly">Quincenal</option><option value="Monthly">Mensual</option>
            </select>
            <div className="rounded-xl border border-brand/10 bg-brand/5 p-3 md:col-span-2">
              <p className="mb-2 text-sm font-bold">Complementos</p>
              {form.complementos.map((item, index) => <div key={`${item.concepto}-${index}`} className="mb-1 flex items-center justify-between text-xs"><span>{item.concepto} · {item.importePz} Pz · {item.tipo === "actividad" ? "Actividad" : "Cargo"}</span><button type="button" className="font-bold text-red-600" onClick={() => setForm({ ...form, complementos: form.complementos.filter((_, itemIndex) => itemIndex !== index) })}>Quitar</button></div>)}
              <div className="mt-2 grid gap-2 md:grid-cols-4">
                <input placeholder="Concepto" value={complemento.concepto} onChange={(e) => setComplemento({ ...complemento, concepto: e.target.value })} className="rounded-lg border border-brand/15 px-2 py-1.5 text-xs" />
                <input type="number" min="0" placeholder="Importe Pz" value={complemento.importePz} onChange={(e) => setComplemento({ ...complemento, importePz: e.target.value })} className="rounded-lg border border-brand/15 px-2 py-1.5 text-xs" />
                <select value={complemento.tipo} onChange={(e) => setComplemento({ ...complemento, tipo: e.target.value })} className="rounded-lg border border-brand/15 bg-white px-2 py-1.5 text-xs"><option value="cargo">Cargo fijo</option><option value="actividad">Actividad</option></select>
                <button type="button" disabled={!complemento.concepto || Number(complemento.importePz) <= 0} onClick={() => { setForm({ ...form, complementos: [...form.complementos, { ...complemento, importePz: Number(complemento.importePz) }] }); setComplemento({ concepto: "", importePz: "", tipo: "cargo", periodicidad: "mensual" }); }} className="rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-brand disabled:opacity-50">Añadir complemento</button>
              </div>
              <p className="mt-2 text-xs text-brand-dark/60">Cargo: fijo mensual. Actividad: solo se paga cuando la empresa la confirma, igual que en la app.</p>
            </div>
            <button disabled={saving || !form.employeeAccountId} type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">{saving ? "Guardando…" : "Guardar contrato por DIP"}</button>
            {!contactos.length && <p className="text-sm text-brand-dark/60 md:col-span-2">Puedes buscar directamente por DIP; los contactos guardados solo son un acceso rápido.</p>}
            {formError && <p className="text-sm text-red-600 md:col-span-2">{formError}</p>}
          </form>
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
            {contratos.map((c) => {
              const abierto = expandedContractId === c.id;
              const estimacion = proximoPago(c);
              return <li key={c.id} className="py-2">
                <button type="button" onClick={() => setExpandedContractId(abierto ? null : c.id)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-brand/5">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-brand-dark">{c.roleTitle || "Trabajador"} · {c.employeeDip || ""}</span><span className="block text-xs text-brand-dark/50">{c.employeeName || ""} · {c.status === "Ended" ? "Finalizado" : "Activo"}</span></span>
                  <span className="text-right"><span className="block text-sm font-extrabold text-brand">{formatPz(c.grossSalaryPz || 0)} Pz</span><span className="text-xs text-brand-dark/50">{c.frequency || "Weekly"}</span></span>
                </button>
                {abierto && <div className="mx-3 mb-2 rounded-xl border border-brand/10 bg-brand/5 p-4 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><p className="text-xs text-brand-dark/50">Empresa / EIP</p><p className="font-bold">{cuenta?.displayName} · {cuenta?.eip || "—"}</p></div>
                    <div><p className="text-xs text-brand-dark/50">Cuenta que abona</p><p className="font-bold">{c.companyAccountId}</p></div>
                    <div><p className="text-xs text-brand-dark/50">Trabajador</p><p className="font-bold">{c.employeeName} · {c.employeeDip}</p></div>
                    <div><p className="text-xs text-brand-dark/50">Cuenta abonada</p><p className="font-bold">{c.employeeAccountId}</p></div>
                    <div><p className="text-xs text-brand-dark/50">Alta</p><p className="font-bold">{c.startDate || "—"}</p></div>
                    <div><p className="text-xs text-brand-dark/50">Estimación próximo pago</p><p className="font-bold">{formatFecha(estimacion.fecha)} · {formatPz(estimacion.neto)} Pz netos</p></div>
                  </div>
                  {(c.complementos || []).length > 0 && <div className="mt-3 border-t border-brand/10 pt-3"><p className="mb-1 font-bold">Complementos</p>{c.complementos.map((item) => <p key={item.id} className="text-xs text-brand-dark/65">{item.concepto} · {formatPz(item.importePz)} Pz · {item.tipo === "actividad" ? "Actividad confirmable" : "Cargo fijo"}</p>)}</div>}
                  {c.status !== "Ended" && <button type="button" disabled={endingId === c.id} onClick={() => despedirTrabajador(c)} className="mt-4 rounded-lg bg-rose-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{endingId === c.id ? "Finalizando…" : "Finalizar / despedir trabajador"}</button>}
                </div>}
              </li>;
            })}
          </ul>
        )}
      </Card>

      {esEmpresa && <Card>
        <SectionTitle title="Calendario y próximos pagos" subtitle={`Coste bruto estimado de la próxima ronda: ${formatPz(costeProximosPagos)} Pz.`} className="mb-3" />
        {contratos.filter((contract) => contract.status !== "Ended").map((contract) => {
          const estimacion = proximoPago(contract);
          return <div key={contract.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/5 py-2 text-sm last:border-0"><span><b>{contract.employeeName || contract.employeeDip}</b><span className="ml-2 text-xs text-brand-dark/50">{contract.frequency || "Weekly"}</span></span><span className="text-right"><b>{formatFecha(estimacion.fecha)}</b><span className="ml-2 text-brand">{formatPz(estimacion.neto)} Pz netos</span></span></div>;
        })}
        {periodos.length > 0 && <div className="mt-4 border-t border-brand/10 pt-3"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-dark/50">Periodos registrados</p>{periodos.slice(0, 8).map((periodo) => <div key={periodo.id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs"><span>{periodo.label || `Nómina ${periodo.periodo}`} · {periodo.employeeName || periodo.employeeDip}</span><span>{periodo.status || "Pending"} · {formatPz(periodo.netoPz || 0)} Pz <a className="ml-2 font-bold text-brand underline" href={`/bff/nominas/periodos/${encodeURIComponent(periodo.id)}/pdf`}>PDF</a></span></div>)}</div>}
      </Card>}

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
                  {r.periodoDoc?.id && <a className="text-xs font-bold text-brand underline" href={`/bff/nominas/periodos/${encodeURIComponent(r.periodoDoc.id)}/pdf`}>Descargar PDF</a>}
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
