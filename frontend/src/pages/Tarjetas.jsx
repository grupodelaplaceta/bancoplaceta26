import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api } from "@/lib/api";

export default function Tarjetas({ cuenta }) {
  const [cards, setCards] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!cuenta) return;
    let alive = true;
    setCards(null);
    api
      .tarjetas(cuenta.id)
      .then((r) => alive && setCards(r.tarjetas || []))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Tarjetas" subtitle={`Vinculadas a ${cuenta?.displayName || "tu cuenta"}.`} />
      <Card>
        {!cards && !err ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : err ? (
          <EmptyState title="No se pudieron cargar las tarjetas" hint={err} />
        ) : cards.length === 0 ? (
          <EmptyState title="Sin tarjetas" hint="No tienes tarjetas digitales en esta cuenta." />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {cards.map((c) => (
              <li
                key={c.id}
                className="rounded-3xl border border-brand/10 bg-gradient-to-br from-[#150259] via-[#2a0d8a] to-[#3204D9] p-5 text-white shadow-[0_18px_38px_rgba(21,2,89,0.2)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/65">Banco de La Placeta</p>
                    <p className="mt-4 font-mono text-xl font-bold tracking-[0.22em]">{c.cardNumber || "••••"}</p>
                  </div>
                  <Badge tone={c.frozen ? "rose" : "green"}>
                    {c.frozen ? "Congelada" : "Activa"}
                  </Badge>
                </div>

                <div className="mt-8 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Alias</p>
                    <p className="mt-1 truncate text-sm font-semibold text-white">{c.alias || "Tarjeta"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Tipo</p>
                    <p className="mt-1 text-sm font-semibold text-white">{c.tier || "Standard"}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">
                  <span>{c.promoPhysical ? "Física" : "Digital"}</span>
                  <span>{c.frozen ? "Bloqueada" : "Disponible"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
