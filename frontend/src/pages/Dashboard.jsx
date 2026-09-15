import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import FluidOrb from "@/components/FluidOrb";
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

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#22005F] via-[#4D00FF] to-[#7B3DFF] p-7 text-white"
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
        <div className="absolute -right-4 -top-4 opacity-90">
          <FluidOrb size={220} color="#7B3DFF" />
        </div>
      </motion.div>

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
