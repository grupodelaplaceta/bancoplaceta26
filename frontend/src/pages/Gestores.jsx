import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api } from "@/lib/api";

export default function Gestores({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [placetaId, setPlacetaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .gestores(cuenta?.id)
      .then((r) => alive && setData(r.gestores || []))
      .catch((e) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  const añadirCotitular = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.añadirCotitular({ accountId: cuenta?.id, placetaId });
      setPlacetaId("");
      setData((await api.gestores(cuenta?.id)).gestores || []);
      setMessage("Cotitular añadido correctamente.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="workspace-page space-y-6">
      <SectionTitle title="Titularidad y accesos" subtitle={`Personas vinculadas a ${cuenta?.displayName || "la cuenta seleccionada"}.`} />

      <Card className="ownership-card">
        <p className="ownership-label">Titular de la cuenta</p>
        <p className="ownership-value">{cuenta?.titularDip || "Titular identificado en PlacetaID"}</p>
        <div className="ownership-meta"><span>Cuenta activa</span><strong>{cuenta?.id || "—"}</strong></div>
        {cuenta?.cotitularDip && <div className="ownership-meta"><span>Cotitular</span><strong>{cuenta.cotitularDip}</strong></div>}
      </Card>

      <Card>
        <SectionTitle title="Añadir cotitular" subtitle="Introduce su DIP de PlacetaID. La cuenta seguirá bajo tu control." className="mb-3" />
        <form onSubmit={añadirCotitular} className="mb-4 flex flex-wrap gap-2">
          <input required value={placetaId} onChange={(event) => setPlacetaId(event.target.value.toUpperCase())} placeholder="DIP del cotitular" className="min-w-0 flex-1 rounded-xl border border-brand/15 px-3 py-2 text-sm" />
          <button disabled={saving || !cuenta?.id} type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Añadiendo…" : "Añadir"}</button>
        </form>
        {message && <p className="mb-4 text-sm text-brand-dark/70">{message}</p>}
        {!data && !err ? (
          <Skeleton className="h-24 w-full" />
        ) : err ? (
          <EmptyState title="No se pudieron cargar los gestores" hint={err} />
        ) : data.length === 0 ? (
          <EmptyState title="Sin gestores" hint="No hay cotitulares ni gestores en tus cuentas." />
        ) : (
          <ul className="divide-y divide-brand/5">
            {data.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/10 text-sm font-extrabold text-brand">
                    {(g.displayName || g.placetaId || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brand-dark">{g.displayName || g.placetaId}</p>
                    <p className="text-xs text-brand-dark/50">{g.placetaId} · {g.accountId || cuenta?.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge tone="brand">{g.role}</Badge>
                  {g.ownershipPercent > 0 && (
                    <p className="mt-1 text-xs text-brand-dark/50">{g.ownershipPercent}%</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
