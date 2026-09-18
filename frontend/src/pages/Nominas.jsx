import { useEffect, useMemo, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

const defaultForm = {
  employeeDip: "",
  employeeName: "",
  employeeAccountId: "",
  roleTitle: "Trabajador",
  grossSalaryPz: "200",
  startDate: new Date().toISOString().slice(0, 10),
  frequency: "Weekly",
  complementos: []
};

export default function Nominas({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [contactos, setContactos] = useState([]);
  const [complemento, setComplemento] = useState({ concepto: "", importePz: "", tipo: "cargo", periodicidad: "mensual" });
  const [buscandoTrabajador, setBuscandoTrabajador] = useState(false);
  const [busquedaError, setBusquedaError] = useState(null);
  const [expandedContractId, setExpandedContractId] = useState(null);
  const [endingId, setEndingId] = useState(null);

  const isAuthError = (value) => {
    const message = String(value || "").trim();
    return message === "no_autenticado" || message.toLowerCase().includes("iniciar sesión") || message.toLowerCase().includes("autentic");
  };

  useEffect(() => {
    let alive = true;
    setData(null);
    setErr(null);

    Promise.all([api.nominas(cuenta?.id), api.contactos(cuenta?.id)])
      .then(([nominas, contactosResponse]) => {
        if (!alive) return;
        setData(nominas || {});
        const contactosList = Array.isArray(contactosResponse?.contactos) ? contactosResponse.contactos : [];
        setContactos(contactosList.filter((contacto) => contacto.type === "Current"));
      })
      .catch((e) => {
        if (!alive) return;
        if (isAuthError(e?.message)) {
          setErr("Tu sesión ha caducado. Vuelve a iniciar sesión para ver tus nóminas.");
          return;
        }
        setErr(e?.message || "No se pudo cargar la información de nóminas.");
      });

    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  const contratos = Array.isArray(data?.contratos) ? data.contratos : [];
  const resumenes = Array.isArray(data?.resumenes) ? data.resumenes : [];
  const periodos = Array.isArray(data?.periodos) ? data.periodos : [];
  const esEmpresa = ["business", "empresa"].includes(String(cuenta?.type || "").toLowerCase());

  const proximoPago = (contract) => {
    const dias = contract.frequency === "Monthly" ? 30 : contract.frequency === "Biweekly" ? 14 : 7;
    const fecha = new Date(Date.now() + dias * 86400000);
    const fijos = (contract.complementos || []).filter((item) => item.tipo !== "actividad" && item.activo !== false).reduce((total, item) => total + (Number(item.importePz) || 0) / (item.periodicidad === "anual" ? 12 : 1), 0);
    const bruto = Number(contract.grossSalaryPz || 0) + fijos;
    const retencion = bruto * Number(data?.config?.retencionPct || 0) / 100;
    return { fecha, bruto, neto: bruto - retencion };
  };

  const metricas = useMemo(() => {
    const activos = contratos.filter((contract) => contract.status !== "Ended");
    const coste = activos.reduce((total, contract) => total + proximoPago(contract).bruto, 0);
    const neto = activos.reduce((total, contract) => total + proximoPago(contract).neto, 0);
    return {
      activos: activos.length,
      coste,
      neto,
      periodo: data?.periodo || "Sin periodo activo"
    };
  }, [contratos, data]);

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
      setForm(defaultForm);
      setComplemento({ concepto: "", importePz: "", tipo: "cargo", periodicidad: "mensual" });
    } catch (error) {
      setFormError(error.message || "No se pudo registrar el contrato.");
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
        <Card className="!border-brand/10 !bg-gradient-to-r !from-brand/5 !via-white !to-brand/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-dark/50">Periodo activo</p>
              <p className="mt-1 text-lg font-extrabold text-brand-dark">{data.periodo}</p>
            </div>
            {data.fechaLimite && (
              <div className="rounded-2xl border border-brand/10 bg-white px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.18em] text-brand-dark/50">Fecha límite</p>
                <p className="mt-1 text-sm font-bold text-brand-dark">{formatFecha(data.fechaLimite)}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {!data && !err ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : null}

      {!err && data && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="!border-brand/10 !bg-gradient-to-br !from-brand/5 !to-white">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-dark/50">Trabajadores</p>
            <p className="mt-3 text-3xl font-black text-brand-dark">{metricas.activos}</p>
            <p className="mt-1 text-sm text-brand-dark/60">Activos en tu nómina</p>
          </Card>
          <Card className="!border-brand/10 !bg-gradient-to-br !from-emerald-50 !to-white">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-dark/50">Próximo pago</p>
            <p className="mt-3 text-3xl font-black text-emerald-700">{formatPz(metricas.neto)}</p>
            <p className="mt-1 text-sm text-brand-dark/60">Neto estimado</p>
          </Card>
          <Card className="!border-brand/10 !bg-gradient-to-br !from-amber-50 !to-white">
            <p className="text-xs uppercase tracking-[0.18em] text-brand-dark/50">Coste bruto</p>
            <p className="mt-3 text-3xl font-black text-amber-700">{formatPz(metricas.coste)}</p>
            <p className="mt-1 text-sm text-brand-dark/60">{metricas.periodo}</p>
          </Card>
        </div>
      )}

      {err && (
        <Card className="!border-red-200 !bg-red-50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Sesión</p>
              <h3 className="mt-1 text-lg font-extrabold text-red-800">{err}</h3>
            </div>
            <button
              type="button"
              onClick={() => window.location.href = "/login"}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-red-200 transition hover:bg-red-700"
            >
              Volver a iniciar sesión
            </button>
          </div>
        </Card>
      )}

      {esEmpresa && !err && (
        <Card className="!border-brand/10 !bg-gradient-to-br !from-brand/5 !via-white !to-brand/5">
          <SectionTitle title="Dar de alta trabajador" subtitle="Crea contratos con datos claros, paga mensualidades y mantiene todos los cálculos en un solo punto." className="mb-3" />
          <form onSubmit={altaTrabajador} className="grid gap-3 md:grid-cols-2">
            <select
              value={form.employeeAccountId}
              onChange={(e) => {
                const contact = contactos.find((item) => item.accountId === e.target.value);
                setForm({ ...form, employeeAccountId: e.target.value, employeeDip: contact?.employeeDip || "", employeeName: contact?.displayName || "" });
              }}
              className="rounded-2xl border border-brand/15 bg-white px-3 py-2.5 text-sm shadow-sm md:col-span-2"
            >
              <option value="">Selecciona un contacto o trabajador</option>
              {contactos.map((contacto) => (
                <option key={contacto.accountId} value={contacto.accountId}>
                  {contacto.displayName} · {contacto.employeeDip}
                </option>
              ))}
            </select>

            <div className="flex gap-2 md:col-span-2">
              <input
                required
                placeholder="DIP del trabajador"
                value={form.employeeDip}
                onChange={(e) => setForm({ ...form, employeeDip: e.target.value.toUpperCase(), employeeAccountId: "", employeeName: "" })}
                className="min-w-0 flex-1 rounded-2xl border border-brand/15 bg-white px-3 py-2.5 text-sm shadow-sm outline-none ring-0 focus:border-brand"
              />
              <button
                type="button"
                disabled={buscandoTrabajador || !form.employeeDip}
                onClick={buscarTrabajador}
                className="rounded-2xl bg-brand/10 px-3 py-2.5 text-sm font-bold text-brand disabled:opacity-50"
              >
                {buscandoTrabajador ? "Buscando…" : "Buscar DIP"}
              </button>
            </div>

            <input
              required
              placeholder="Nombre del trabajador"
              value={form.employeeName}
              readOnly
              className="rounded-2xl border border-brand/15 bg-brand/5 px-3 py-2.5 text-sm shadow-sm"
            />

            <input
              required
              placeholder="Puesto / función"
              value={form.roleTitle}
              onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
              className="rounded-2xl border border-brand/15 bg-white px-3 py-2.5 text-sm shadow-sm"
            />

            <input
              required
              min="0"
              type="number"
              placeholder="Salario bruto Pz"
              value={form.grossSalaryPz}
              onChange={(e) => setForm({ ...form, grossSalaryPz: e.target.value })}
              className="rounded-2xl border border-brand/15 bg-white px-3 py-2.5 text-sm shadow-sm"
            />

            <input
              required
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              className="rounded-2xl border border-brand/15 bg-white px-3 py-2.5 text-sm shadow-sm"
            />

            <select
              value={form.frequency}
              onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              className="rounded-2xl border border-brand/15 bg-white px-3 py-2.5 text-sm shadow-sm"
            >
              <option value="Weekly">Semanal</option>
              <option value="Biweekly">Quincenal</option>
              <option value="Monthly">Mensual</option>
            </select>

            <div className="rounded-2xl border border-brand/10 bg-white p-3 md:col-span-2">
              <p className="mb-2 text-sm font-bold text-brand-dark">Complementos</p>
              {form.complementos.length === 0 ? (
                <p className="text-xs text-brand-dark/55">Sin complementos añadidos. Puedes añadir cargos o actividades para el cálculo.</p>
              ) : (
                <div className="space-y-2">
                  {form.complementos.map((item, index) => (
                    <div key={`${item.concepto}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-brand/5 px-3 py-2 text-xs">
                      <span>
                        {item.concepto} · {item.importePz} Pz · {item.tipo === "actividad" ? "Actividad" : "Cargo"}
                      </span>
                      <button type="button" className="font-bold text-red-600" onClick={() => setForm({ ...form, complementos: form.complementos.filter((_, itemIndex) => itemIndex !== index) })}>Quitar</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 grid gap-2 md:grid-cols-4">
                <input
                  placeholder="Concepto"
                  value={complemento.concepto}
                  onChange={(e) => setComplemento({ ...complemento, concepto: e.target.value })}
                  className="rounded-xl border border-brand/15 px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Importe Pz"
                  value={complemento.importePz}
                  onChange={(e) => setComplemento({ ...complemento, importePz: e.target.value })}
                  className="rounded-xl border border-brand/15 px-2 py-1.5 text-xs"
                />
                <select
                  value={complemento.tipo}
                  onChange={(e) => setComplemento({ ...complemento, tipo: e.target.value })}
                  className="rounded-xl border border-brand/15 bg-white px-2 py-1.5 text-xs"
                >
                  <option value="cargo">Cargo fijo</option>
                  <option value="actividad">Actividad</option>
                </select>
                <button
                  type="button"
                  disabled={!complemento.concepto || Number(complemento.importePz) <= 0}
                  onClick={() => {
                    setForm({ ...form, complementos: [...form.complementos, { ...complemento, importePz: Number(complemento.importePz) }] });
                    setComplemento({ concepto: "", importePz: "", tipo: "cargo", periodicidad: "mensual" });
                  }}
                  className="rounded-xl bg-brand/10 px-2 py-1.5 text-xs font-bold text-brand disabled:opacity-50"
                >
                  Añadir
                </button>
              </div>
            </div>

            {busquedaError && <p className="text-sm text-red-600 md:col-span-2">{busquedaError}</p>}
            {formError && <p className="text-sm text-red-600 md:col-span-2">{formError}</p>}

            <button
              disabled={saving || !form.employeeAccountId}
              type="submit"
              className="rounded-2xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50 md:col-span-2"
            >
              {saving ? "Guardando…" : "Guardar contrato por DIP"}
            </button>

            {!contactos.length && (
              <p className="text-sm text-brand-dark/60 md:col-span-2">
                Puedes buscar directamente por DIP; los contactos guardados solo son un acceso rápido.
              </p>
            )}
          </form>
        </Card>
      )}

      {!err && (
        <Card>
          <SectionTitle title="Contratos" className="mb-3" />
          {!data ? (
            <Skeleton className="h-24 w-full" />
          ) : contratos.length === 0 ? (
            <EmptyState title="Sin contratos de nómina" hint="Todavía no hay contratos asociados a esta cuenta." />
          ) : (
            <ul className="space-y-2">
              {contratos.map((c) => {
                const abierto = expandedContractId === c.id;
                const estimacion = proximoPago(c);
                return (
                  <li key={c.id} className="rounded-2xl border border-brand/10 bg-white p-2 shadow-sm shadow-brand/5">
                    <button
                      type="button"
                      onClick={() => setExpandedContractId(abierto ? null : c.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-brand/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-brand-dark">{c.roleTitle || "Trabajador"} · {c.employeeDip || ""}</p>
                        <p className="mt-1 text-xs text-brand-dark/50">{c.employeeName || ""} · {c.status === "Ended" ? "Finalizado" : "Activo"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-extrabold text-brand">{formatPz(c.grossSalaryPz || 0)} Pz</p>
                        <p className="text-[11px] text-brand-dark/50">{c.frequency || "Weekly"}</p>
                      </div>
                    </button>

                    {abierto && (
                      <div className="mt-2 rounded-2xl border border-brand/10 bg-brand/5 p-4 text-sm">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-dark/50">Empresa / EIP</p>
                            <p className="mt-1 font-bold">{cuenta?.displayName} · {cuenta?.eip || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-dark/50">Cuenta que abona</p>
                            <p className="mt-1 font-bold">{c.companyAccountId}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-dark/50">Trabajador</p>
                            <p className="mt-1 font-bold">{c.employeeName} · {c.employeeDip}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-dark/50">Cuenta abonada</p>
                            <p className="mt-1 font-bold">{c.employeeAccountId}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-dark/50">Alta</p>
                            <p className="mt-1 font-bold">{c.startDate || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-dark/50">Siguiente pago</p>
                            <p className="mt-1 font-bold">{formatFecha(estimacion.fecha)} · {formatPz(estimacion.neto)} Pz netos</p>
                          </div>
                        </div>

                        {(c.complementos || []).length > 0 && (
                          <div className="mt-4 border-t border-brand/10 pt-3">
                            <p className="mb-2 font-bold">Complementos</p>
                            {c.complementos.map((item) => (
                              <div key={item.id} className="flex justify-between gap-3 text-xs text-brand-dark/70">
                                <span>{item.concepto}</span>
                                <span>{formatPz(item.importePz)} Pz · {item.tipo === "actividad" ? "Actividad" : "Cargo"}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <a className="rounded-xl bg-brand/10 px-3 py-2 text-xs font-bold text-brand" href={`/bff/nominas/contratos/${encodeURIComponent(c.id)}/pdf`}>
                            Descargar PDF
                          </a>
                          {c.status !== "Ended" && (
                            <button
                              type="button"
                              disabled={endingId === c.id}
                              onClick={() => despedirTrabajador(c)}
                              className="rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {endingId === c.id ? "Finalizando…" : "Finalizar / despedir"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {!err && esEmpresa && (
        <Card>
          <SectionTitle title="Calendario y próximos pagos" subtitle={`Coste bruto estimado de la próxima ronda: ${formatPz(metricas.coste)} Pz.`} className="mb-3" />
          {contratos.filter((contract) => contract.status !== "Ended").map((contract) => {
            const estimacion = proximoPago(contract);
            return (
              <div key={contract.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-brand/5 py-2 text-sm last:border-0">
                <span>
                  <b>{contract.employeeName || contract.employeeDip}</b>
                  <span className="ml-2 text-xs text-brand-dark/50">{contract.frequency || "Weekly"}</span>
                </span>
                <span className="text-right">
                  <b>{formatFecha(estimacion.fecha)}</b>
                  <span className="ml-2 text-brand">{formatPz(estimacion.neto)} Pz netos</span>
                </span>
              </div>
            );
          })}

          {periodos.length > 0 && (
            <div className="mt-4 border-t border-brand/10 pt-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-dark/50">Periodos registrados</p>
              {periodos.slice(0, 8).map((periodo) => (
                <div key={periodo.id} className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs">
                  <span>{periodo.label || `Nómina ${periodo.periodo}`} · {periodo.employeeName || periodo.employeeDip}</span>
                  <span>
                    {periodo.status || "Pending"} · {formatPz(periodo.netoPz || 0)} Pz
                    <a className="ml-2 font-bold text-brand underline" href={`/bff/nominas/periodos/${encodeURIComponent(periodo.id)}/pdf`}>PDF</a>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {!err && (
        <Card>
          <SectionTitle title="Resúmenes" className="mb-3" />
          {!data ? (
            <Skeleton className="h-24 w-full" />
          ) : resumenes.length === 0 ? (
            <EmptyState title="Sin resúmenes" hint="Aún no hay periodos de nómina liquidados." />
          ) : (
            <ul className="space-y-2">
              {resumenes.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-brand/10 bg-brand/5 px-3 py-3">
                  <div>
                    <p className="text-sm font-bold text-brand-dark">{r.periodo || r.mes || r.id}</p>
                    {r.periodoDoc?.id && (
                      <a className="mt-1 block text-xs font-bold text-brand underline" href={`/bff/nominas/periodos/${encodeURIComponent(r.periodoDoc.id)}/pdf`}>
                        Descargar PDF
                      </a>
                    )}
                    <p className="mt-1 text-xs text-brand-dark/50">{r.contrato?.employeeDip || r.employeeDip || ""}</p>
                  </div>
                  <span className="text-sm font-extrabold text-brand">{formatPz(r.totalPz || r.netoPz || r.amountPz)} Pz</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
