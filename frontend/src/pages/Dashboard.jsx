import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Dashboard({ cuenta }) {
  const [movs, setMovs] = useState(null);
  const [err, setErr] = useState(null);

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
  const esEmpresa = tipo === 'business' || tipo === 'empresa' || tipo === 'organismo';
  const esJunior = tipo === 'junior' || tipo.includes('juvenil');
  const perfil = esJunior
    ? { nombre: 'Cuenta Placeta Junior', descripcion: 'Operativa supervisada para menores de 16 años.', acciones: [['PlaceZUM', '#placezum'], ['Movimientos', '#movimientos'], ['Normativa', '#normativa']] }
    : esEmpresa
      ? { nombre: 'Cuenta de empresa', descripcion: 'Herramientas para tesorería, facturación y obligaciones del proyecto.', acciones: [['Facturación', '#facturacion'], ['Tributos', '#tributos'], ['Documentos', '#normativa']] }
      : { nombre: 'Cuenta personal', descripcion: 'Gestiona tus Placetas, pagos y documentación desde un único espacio.', acciones: [['Transferir', '#transferencia'], ['PlaceZUM', '#placezum'], ['Movimientos', '#movimientos']] };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-[#150259] p-7 text-white shadow-[0_18px_40px_rgba(21,2,89,.18)]"
      >
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">
            Saldo disponible
          </p>
          <div className="mt-3 flex items-baseline gap-1">
            <AnimatedCounter
              value={saldo}
              className="text-5xl font-extrabold tracking-tight"
              suffix=" Pz"
            />
          </div>
          <p className="mt-3 text-sm text-white/80">
            {cuenta?.displayName || "Cuenta"} · {cuenta?.id || "—"}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge tone="gray" className="!bg-white/15 !text-white">
              {cuenta?.type === "Business" ? "Empresa" : "Ciudadana"}
            </Badge>
            {cuenta?.eip && (
              <Badge tone="gray" className="!bg-white/15 !text-white">
                {cuenta.eip}
              </Badge>
            )}
          </div>
        </div>
        <div className="dashboard-brand-art" aria-hidden="true">
          <img src="/img/bancologosobreoscuro.png" alt="Banco de La Placeta" />
          <span />
        </div>
      </motion.div>

      <section className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <Card className="account-profile-card">
          <div className="flex items-start justify-between gap-4">
            <div><p className="eyebrow">Espacio de cuenta</p><h2 className="mt-1 text-lg font-extrabold text-brand-dark">{perfil.nombre}</h2><p className="mt-1 text-sm text-brand-dark/55">{perfil.descripcion}</p></div>
            <span className="account-type-mark" aria-hidden="true">{esJunior ? 'J' : esEmpresa ? 'E' : 'P'}</span>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">{perfil.acciones.map(([label, href]) => <a key={href} href={href} className="account-quick-link">{label}<span aria-hidden="true">→</span></a>)}</div>
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
            {movs.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-brand-dark">
                    {m.concept || m.kind}
                  </p>
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
