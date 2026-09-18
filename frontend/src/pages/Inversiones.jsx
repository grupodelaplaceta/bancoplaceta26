import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/Icon";
import { Badge, Card, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { api, formatFecha, formatPz } from "@/lib/api";

const riskTone = { 1: "green", 2: "green", 3: "amber", 4: "rose", 5: "rose" };
const riskLabel = { 1: "Muy bajo", 2: "Bajo", 3: "Moderado", 4: "Alto", 5: "Muy alto" };

function secondsLeft(operation) {
  return Math.max(0, Math.ceil((new Date(operation.liquidateAt || operation.readyAt || 0).getTime() - Date.now()) / 1000));
}

export default function Inversiones({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [entityId, setEntityId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [tick, setTick] = useState(Date.now());

  const cargar = async () => {
    try {
      const response = await api.inversiones(cuenta?.id);
      setData(response);
      setErr(null);
      const entidades = Array.isArray(response?.entidades)
        ? response.entidades
        : Array.isArray(response?.opciones)
          ? response.opciones
          : Array.isArray(response?.fondos)
            ? response.fondos
            : [];
      if (!entityId && entidades[0]) setEntityId(entidades[0].id || entidades[0].entityId || entidades[0].codigo || "");
    } catch (error) {
      setErr(error.message);
    }
  };

  useEffect(() => {
    setData(null);
    setErr(null);
    cargar();
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [cuenta?.id]);

  const operaciones = Array.isArray(data?.operaciones) ? data.operaciones : [];
  const entidades = Array.isArray(data?.entidades)
    ? data.entidades
    : Array.isArray(data?.opciones)
      ? data.opciones
      : Array.isArray(data?.fondos)
        ? data.fondos
        : [];
  const activas = operaciones.filter((operation) => !operation.settledAt && secondsLeft(operation) > 0);
  const vencidas = operaciones.filter((operation) => !operation.settledAt && secondsLeft(operation) <= 0);
  const entidad = entidades.find((item) => (item.id || item.entityId || item.codigo) === entityId) || entidades[0] || null;
  const maxAmount = entidad ? Math.min(Math.floor((Number(cuenta?.balancePz) || 0) * .25), Number(entidad.disponiblePz || entidad.disponible || entidad.capacidadPz || 0), 5000) : 0;
  const totalActivo = activas.reduce((sum, operation) => sum + Number(operation.amountPz || 0), 0);
  const proximoVencimiento = activas.length
    ? Math.min(...activas.map((operation) => secondsLeft(operation)))
    : 0;
  const riesgoPromedio = entidad ? riskLabel[entidad.riskLevel] || "Moderado" : "Moderado";

  const iniciar = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      await api.iniciarInversion({ accountId: cuenta?.id, entityId, amountPz: Number(amount) });
      setAmount("");
      setNotice({ type: "success", text: "Inversión iniciada. El resultado ya ha quedado fijado por Banco." });
      await cargar();
    } catch (error) {
      setNotice({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!vencidas.length) return;
    vencidas.forEach(async (operation) => {
      try { await api.liquidarInversion(operation.investmentId || operation.id); } catch { /* el siguiente refresco reintentará */ }
    });
    const refresh = window.setTimeout(cargar, 800);
    return () => window.clearTimeout(refresh);
  }, [tick, vencidas.length]);

  const estimated = useMemo(() => {
    if (!entidad) return null;
    const maxLoss = entidad.riskLevel === 1 ? 2 : entidad.riskLevel === 2 ? 4 : entidad.riskLevel === 3 ? 7 : entidad.riskLevel === 4 ? 12 : 20;
    return `-${maxLoss}% / +20%`;
  }, [entidad]);

  if (err && !data) return <EmptyState title="No se pudieron cargar las inversiones" hint={err} />;
  const listaEntidades = entidades.length ? entidades : [];

  return (
    <div className="investment-page space-y-6">
      <div className="investment-hero">
        <div><p className="eyebrow">Mercado del Fondo</p><h1>Inversión 60s</h1><p>Invierte temporalmente a través del Fondo. El resultado se determina al iniciar y la liquidación ocurre automáticamente al segundo 60.</p></div>
        <div className="investment-hero-orb" aria-hidden="true"><span>60</span><small>s</small></div>
      </div>

      {notice && <div className={`workspace-alert ${notice.type === "error" ? "workspace-alert-error" : "workspace-alert-success"}`}>{notice.text}</div>}
      {!data ? <Card><Skeleton className="h-40 w-full" /></Card> : data.disponible === false && listaEntidades.length === 0 ? <Card><EmptyState title="Cuenta no habilitada" hint="La Inversión 60s requiere una cuenta de inversión o de empresa autorizada." /></Card> : <>
        <section className="investment-summary-grid">
          <Card className="investment-summary-card investment-summary-card-primary">
            <span className="investment-summary-label">Mercado destacado</span>
            <strong className="investment-summary-value">{entidad?.nombre || "Fondo de corto plazo"}</strong>
            <span className="investment-summary-trend">Riesgo {riesgoPromedio} · Patrimonio disponible {formatPz(entidad?.capacidadPz || 0)} Pz</span>
          </Card>
          <Card className="investment-summary-card">
            <span className="investment-summary-label">Activo ahora</span>
            <strong className="investment-summary-value">{formatPz(totalActivo)}</strong>
            <span className="investment-summary-trend">{activas.length} posiciones vivas</span>
          </Card>
          <Card className="investment-summary-card">
            <span className="investment-summary-label">Siguiente vencimiento</span>
            <strong className="investment-summary-value">{proximoVencimiento ? `${proximoVencimiento}s` : "-"}</strong>
            <span className="investment-summary-trend">Liquidación automática</span>
          </Card>
        </section>

        <section className="investment-layout">
          <Card className="investment-start-card">
            <SectionTitle title="Nueva inversión" subtitle="Pz bloqueados durante 60 segundos." className="mb-4" />
            <form onSubmit={iniciar} className="space-y-4">
              <label className="investment-field">Entidad del Fondo<select required value={entityId} onChange={(event) => setEntityId(event.target.value)}><option value="">Selecciona una entidad</option>{listaEntidades.map((item) => <option key={item.id || item.entityId || item.codigo} value={item.id || item.entityId || item.codigo}>{item.nombre || item.name || item.entityName} · Riesgo {riskLabel[item.riskLevel || 3]}</option>)}</select></label>
              {entidad && <div className="investment-entity-preview"><div><strong>{entidad.nombre || entidad.name || entidad.entityName}</strong><span>{Number(entidad.invertidoPz || entidad.invertido || 0).toLocaleString("es-ES")} / {Number(entidad.capacidadPz || entidad.capacidad || 0).toLocaleString("es-ES")} Pz captados</span></div><Badge tone={riskTone[entidad.riskLevel || 3] || "amber"}>{riskLabel[entidad.riskLevel || 3]}</Badge></div>}
              <label className="investment-field">Importe a invertir<input required type="number" min="1" max={maxAmount || undefined} step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="500" /><small>Máximo recomendado ahora: {formatPz(maxAmount)} Pz</small></label>
              <div className="investment-estimate"><span>Escenario limitado</span><strong>{estimated || "Selecciona una entidad"}</strong><small>El componente aleatorio está limitado por el riesgo. No es una promesa de rentabilidad.</small></div>
              <button className="investment-primary-button" disabled={saving || !entityId || Number(amount) <= 0 || Number(amount) > maxAmount} type="submit"><Icon name="chart" size={18} />{saving ? "Creando posición…" : "Invertir durante 60s"}</button>
            </form>
          </Card>
          <Card className="investment-limits-card"><SectionTitle title="Tus límites" className="mb-4" /><div className="investment-limit-row"><span>Saldo disponible</span><strong>{formatPz(cuenta?.balancePz)} Pz</strong></div><div className="investment-limit-row"><span>Activo ahora</span><strong>{formatPz(totalActivo)} / 10.000 Pz</strong></div><div className="investment-limit-row"><span>Por posición</span><strong>25 % del saldo</strong></div><div className="investment-limit-row"><span>Duración fija</span><strong>60 segundos</strong></div><p className="investment-disclaimer">Banco calcula, firma y conserva el resultado al comienzo de cada operación. No se puede modificar ni repetir.</p></Card>
        </section>

        <section><div className="flex items-end justify-between gap-3"><SectionTitle title="Posiciones activas" subtitle="El contador continúa aunque cierres la aplicación." className="mb-3" /><span className="investment-active-count">{activas.length} activas</span></div>{activas.length === 0 ? <Card><EmptyState title="Sin posiciones activas" hint="Elige una entidad para iniciar una inversión temporal." /></Card> : <div className="investment-active-grid"><AnimatePresence>{activas.map((operation) => <motion.div key={operation.id} layout initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}><Card className="investment-active-card"><div className="investment-active-top"><span className="investment-pulse" /> <span>Posición activa</span><Badge tone="amber">{secondsLeft(operation)}s</Badge></div><h3>{operation.assetName || operation.entityId}</h3><div className="investment-active-amount">{formatPz(operation.amountPz)} <small>Pz bloqueados</small></div><div className="investment-progress"><span style={{ width: `${Math.min(100, ((60 - secondsLeft(operation)) / 60) * 100)}%` }} /></div><p>Resultado fijado · {operation.riskLabel || `Riesgo ${operation.riskLevel}`}</p></Card></motion.div>)}</AnimatePresence></div>}</section>

        <Card><SectionTitle title="Historial de liquidaciones" subtitle="Operaciones verificables del Fondo." className="mb-3" />{operaciones.filter((operation) => operation.settledAt).length === 0 ? <EmptyState title="Aún no hay liquidaciones" hint="Tu historial aparecerá aquí al terminar una posición." /> : <ul className="divide-y divide-brand/5">{operaciones.filter((operation) => operation.settledAt).slice(0, 12).map((operation) => <li key={operation.id} className="investment-history-row"><div><strong>{operation.assetName || operation.entityId}</strong><span>{formatFecha(operation.settledAt)} · {operation.investmentId || operation.id}</span></div><div className="text-right"><strong className={Number(operation.resultPz) >= 0 ? "text-emerald-600" : "text-rose-500"}>{Number(operation.resultPz) >= 0 ? "+" : ""}{formatPz(operation.resultPz)} Pz</strong><span>Total {formatPz(operation.payoutPz)} Pz</span></div></li>)}</ul>}</Card>
      </>}
    </div>
  );
}
