import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api, formatPz, formatFecha } from "@/lib/api";

export default function Movimientos({ cuenta }) {
  const [movs, setMovs] = useState(null);
  const [err, setErr] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!cuenta) return;
    let alive = true;
    setMovs(null);
    setSelectedId(null);
    api
      .movimientos(cuenta.id, 200)
      .then((r) => alive && setMovs(r.movimientos || []))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Movimientos"
        subtitle={`Historial completo de ${cuenta?.displayName || "tu cuenta"}.`}
      />

      <Card>
        {!movs && !err ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : err ? (
          <EmptyState title="No se pudieron cargar los movimientos" hint={err} />
        ) : movs.length === 0 ? (
          <EmptyState title="Sin movimientos" hint="Todavía no hay operaciones en esta cuenta." />
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
                        <p className="text-sm font-extrabold text-brand-dark">Detalle del movimiento</p>
                        <Badge tone={m.status === "Settled" ? "green" : m.status === "Pending" ? "amber" : "gray"}>{m.status === "Settled" ? "Completado" : m.status === "Pending" ? "Pendiente" : m.status || "Registrado"}</Badge>
                      </div>
                      <dl className="grid gap-x-5 gap-y-2 text-xs sm:grid-cols-2">
                        <div><dt className="text-brand-dark/50">Concepto</dt><dd className="font-bold text-brand-dark">{m.concept || "Movimiento bancario"}</dd></div>
                        <div><dt className="text-brand-dark/50">Importe</dt><dd className={`font-bold ${m.esEntrada ? "text-emerald-600" : "text-rose-500"}`}>{m.esEntrada ? "+" : "−"}{formatPz(m.amountPz)} Pz</dd></div>
                        <div><dt className="text-brand-dark/50">Cuenta origen</dt><dd className="font-semibold text-brand-dark">{m.fromAccountId || "—"}</dd></div>
                        <div><dt className="text-brand-dark/50">Cuenta destino</dt><dd className="font-semibold text-brand-dark">{m.toAccountId || "—"}</dd></div>
                        <div><dt className="text-brand-dark/50">Fecha</dt><dd className="font-semibold text-brand-dark">{formatFecha(m.createdAt)}</dd></div>
                        <div><dt className="text-brand-dark/50">IVA</dt><dd className="font-semibold text-brand-dark">{formatPz(m.ivaPz || 0)} Pz</dd></div>
                        <div><dt className="text-brand-dark/50">Referencia</dt><dd className="break-all font-semibold text-brand-dark">{m.id}</dd></div>
                      </dl>
                      <a href={`/bff/movimientos/${encodeURIComponent(m.id)}/comprobante.pdf`} className="mt-4 inline-flex rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white">Descargar comprobante PDF</a>
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
