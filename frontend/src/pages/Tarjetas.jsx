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
          <ul className="grid gap-3 sm:grid-cols-2">
            {cards.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl bg-gradient-to-br from-brand-dark to-brand p-5 text-white"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-white/60">Banco de La Placeta</p>
                    <p className="mt-3 font-mono text-lg font-semibold tracking-wider">{c.cardNumber}</p>
                  </div>
                  <Badge tone={c.frozen ? "rose" : "green"}>
                    {c.frozen ? "Congelada" : "Activa"}
                  </Badge>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-white/80">
                  <span>{c.alias || "Tarjeta"}</span>
                  <span>{c.tier}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
