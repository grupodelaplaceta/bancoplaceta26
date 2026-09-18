import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import Icon from "@/components/Icon";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Dashboard({ cuenta }) {
  const [movs, setMovs] = useState(null);
  const [err, setErr] = useState(null);
  const [saldoVisible, setSaldoVisible] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!cuenta) return;
    let alive = true;
    api
      .movimientos(cuenta.id, 8)
      .then((r) => alive && setMovs(r.movimientos || []))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta]);

  const saldo = Number(cuenta?.balancePz) || 0;
  const tipo = String(cuenta?.type || '').toLowerCase();
  const esAhorro = tipo === 'savings' || tipo === 'ahorro';
  const esEmpresa = tipo === 'business' || tipo === 'empresa' || tipo === 'organismo';
  const esJunior = tipo === 'junior' || tipo.includes('juvenil');
  const perfil = esJunior
    ? { nombre: 'Cuenta Placeta Junior', descripcion: 'Operativa supervisada para menores de 16 años.', acciones: [['PlaceZUM', '#placezum', 'zum'], ['Movimientos', '#movimientos', 'activity'], ['Normativa', '#normativa', 'book']] }
    : esEmpresa
      ? { nombre: 'Cuenta de empresa', descripcion: 'Herramientas para tesorería, pagos y control del proyecto.', acciones: [['Transferir', '#transferencia', 'send'], ['Gestores', '#gestores', 'users'], ['Movimientos', '#movimientos', 'activity'], ['Documentos', '#normativa', 'book']] }
      : esAhorro
        ? { nombre: 'Cuenta de ahorro', descripcion: 'Rendimiento directo diario del 0,02 % desde Banco de La Placeta.', acciones: [['Transferir', '#transferencia', 'send'], ['Ver movimientos', '#movimientos', 'activity'], ['Ver tarjetas', '#tarjetas', 'card'], ['Inversiones', '#inversiones', 'briefcase']] }
        : { nombre: 'Cuenta personal', descripcion: 'Gestiona tus Placetas, pagos y documentación desde un único espacio.', acciones: [['Enviar Placetas', '#transferencia', 'send'], ['Recargar', '#transferencia', 'plus'], ['Pagar servicios', '#placezum', 'receipt'], ['Proyectos', '#inversiones', 'briefcase']] };

  return (
    <div className="space-y-6">
      <section className="dashboard-showcase">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="wallet-card"
        >
          <div className="wallet-card-content">
            <div className="wallet-card-heading"><span>Mi Billetera</span><button type="button" className="wallet-eye" aria-label={saldoVisible ? "Ocultar saldo" : "Mostrar saldo"} onClick={() => setSaldoVisible((visible) => !visible)}><Icon name={saldoVisible ? "eye" : "eye-off"} size={25} /></button></div>
            <div className="wallet-balance">{saldoVisible ? <AnimatedCounter value={saldo} className="wallet-balance-value" suffix="" /> : <span className="wallet-hidden-value">••••••</span>}</div>
            <div className="wallet-currency"><span className="coin coin-small" aria-hidden="true" /> <span>Placetas</span></div>
            <a href="#movimientos" className="wallet-movements-link">Ver movimientos <span aria-hidden="true">→</span></a>
          </div>
          <div className="wallet-art" aria-hidden="true"><span className="coin coin-large" /><span className="coin coin-medium" /><span className="coin coin-tiny" /><span className="wallet-wave wallet-wave-one" /><span className="wallet-wave wallet-wave-two" /></div>
        </motion.div>

        <div className="quick-actions-panel">
          <div className="quick-actions-heading"><h2>Acciones rápidas</h2><span>{cuenta?.displayName || "Cuenta"}</span></div>
          <div className="quick-actions-grid">
            {perfil.acciones.map(([label, href, icon], index) => <a key={`${href}-${label}`} href={href} className={`quick-action ${index === 0 ? "quick-action-primary" : ""}`}><span className="quick-action-icon"><Icon name={icon} size={25} /></span><span>{label}</span></a>)}
          </div>
        </div>
      </section>

      <section className="dashboard-graphic-strip" aria-hidden="true"><span className="graphic-wave graphic-wave-one" /><span className="graphic-wave graphic-wave-two" /><span className="graphic-coin graphic-coin-one" /><span className="graphic-coin graphic-coin-two" /><span className="graphic-coin graphic-coin-three" /></section>

      <section className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <Card className="account-profile-card">
          <div className="flex items-start justify-between gap-4">
            <div><p className="eyebrow">Espacio de cuenta</p><h2 className="mt-1 text-lg font-extrabold text-brand-dark">{perfil.nombre}</h2><p className="mt-1 text-sm text-brand-dark/55">{perfil.descripcion}</p></div>
            <span className="account-type-mark" aria-hidden="true">{esJunior ? 'J' : esEmpresa ? 'E' : 'P'}</span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">{perfil.acciones.slice(0, 3).map(([label, href]) => <a key={href} href={href} className="account-quick-link">{label}<span aria-hidden="true">→</span></a>)}</div>
        </Card>
        <Card className="account-context-card"><p className="eyebrow">Cuenta seleccionada</p><p className="mt-2 text-base font-extrabold text-brand-dark">{cuenta?.displayName || 'Cuenta'}</p><p className="mt-1 break-all text-xs text-brand-dark/55">{cuenta?.id || '—'}</p><p className="mt-4 text-xs leading-relaxed text-brand-dark/55">Las operaciones y límites mostrados corresponden únicamente a esta cuenta.</p></Card>
      </section>

      <Card>
        <SectionTitle
          title="Últimos movimientos"
          subtitle={`De ${cuenta?.displayName || "tu cuenta"}`}
        />
        {!movs && !err ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : err ? (
          <EmptyState title="No se pudieron cargar los movimientos" hint={err} />
        ) : movs.length === 0 ? (
          <EmptyState title="Sin movimientos todavía" hint="Cuando realices una operación aparecerá aquí." />
        ) : (
          <ul className="divide-y divide-brand/5">
            {movs.map((m) => {
              const abierto = selectedId === m.id;
              return (
                <li key={m.id} className="py-1">
                  <button type="button" onClick={() => setSelectedId(abierto ? null : m.id)} className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-brand/5">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg ${m.esEntrada ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-500"}`} aria-hidden="true">{m.esEntrada ? "↓" : "↑"}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-brand-dark">{m.concept || "Movimiento bancario"}</span>
                        <span className="block text-xs text-brand-dark/50">{formatFecha(m.createdAt)} · {m.status === "Settled" ? "Completado" : m.status === "Pending" ? "Pendiente" : m.status || "Registrado"}</span>
                      </span>
                    </span>
                    <span className={`whitespace-nowrap text-sm font-extrabold ${m.esEntrada ? "text-emerald-600" : "text-rose-500"}`}>{m.esEntrada ? "+" : "−"}{formatPz(m.amountPz)} Pz</span>
                  </button>
                  {abierto && (
                    <div className="mx-3 mb-2 rounded-xl border border-brand/10 bg-brand/5 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-extrabold text-brand-dark">Detalle</p>
                        <Badge tone={m.status === "Settled" ? "green" : m.status === "Pending" ? "amber" : "gray"}>{m.status === "Settled" ? "Completado" : m.status === "Pending" ? "Pendiente" : m.status || "Registrado"}</Badge>
                      </div>
                      <dl className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
                        <div><dt className="text-brand-dark/50">Concepto</dt><dd className="font-bold text-brand-dark">{m.concept || "Movimiento bancario"}</dd></div>
                        <div><dt className="text-brand-dark/50">Importe</dt><dd className={`font-bold ${m.esEntrada ? "text-emerald-600" : "text-rose-500"}`}>{m.esEntrada ? "+" : "−"}{formatPz(m.amountPz)} Pz</dd></div>
                        <div><dt className="text-brand-dark/50">Cuenta origen</dt><dd className="font-semibold text-brand-dark">{m.fromAccountId || "—"}</dd></div>
                        <div><dt className="text-brand-dark/50">Cuenta destino</dt><dd className="font-semibold text-brand-dark">{m.toAccountId || "—"}</dd></div>
                        <div><dt className="text-brand-dark/50">Fecha</dt><dd className="font-semibold text-brand-dark">{formatFecha(m.createdAt)}</dd></div>
                        <div><dt className="text-brand-dark/50">Referencia</dt><dd className="break-all font-semibold text-brand-dark">{m.id}</dd></div>
                      </dl>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
