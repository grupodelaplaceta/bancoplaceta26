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

      <Card className="overflow-hidden border-0 bg-gradient-to-r from-[#0c0228] via-[#17074e] to-[#2a0d8a] text-white shadow-[0_18px_38px_rgba(20,4,78,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/60">Panel de tarjetas</p>
            <h3 className="mt-2 text-2xl font-black text-white">Control financiero y seguridad</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="green">Activas</Badge>
            <Badge tone="brand">Pago seguro</Badge>
            <Badge tone="slate">Límites</Badge>
          </div>
        </div>
      </Card>

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
                className="overflow-hidden rounded-[28px] border border-brand/10 bg-white shadow-[0_20px_40px_rgba(22,11,74,0.12)]"
              >
                <div className="relative h-40 overflow-hidden border-b border-brand/10">
                  <img
                    src={c.image || c.cardImage || "/img/tarjta-debito-26.jpg"}
                    alt={c.alias || "Tarjeta bancaria"}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0227]/75 via-[#0b0227]/10 to-transparent" />
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white">{c.frozen ? "Congelada" : "Activa"}</span>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-dark/55">Banco de La Placeta</p>
                      <p className="mt-3 font-mono text-lg font-bold tracking-[0.2em] text-brand-dark">{c.cardNumber || "••••"}</p>
                    </div>
                    <Badge tone={c.frozen ? "rose" : "green"}>
                      {c.frozen ? "Bloqueada" : "Disponible"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 rounded-2xl bg-brand/5 p-3 text-sm text-brand-dark/75">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-dark/50">Alias</span>
                      <span className="font-bold text-brand-dark">{c.alias || "Tarjeta"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-dark/50">Tipo</span>
                      <span className="font-bold text-brand-dark">{c.tier || "Standard"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-dark/50">Límite</span>
                      <span className="font-bold text-brand-dark">{c.limit || "5000 Pz"}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 rounded-full border border-brand/10 bg-brand/5 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-dark/70">
                      <span className="inline-block h-2 w-2 rounded-full bg-brand" />
                      {c.promoPhysical ? "Física" : "Digital"}
                    </div>
                    <button type="button" className="rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white transition hover:bg-brand-dark">
                      Gestionar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
