import { useEffect, useState } from "react";
import { Card, SectionTitle, Skeleton, EmptyState, Badge } from "@/components/ui";
import { api } from "@/lib/api";

export default function Gestores({ cuenta }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [placetaId, setPlacetaId] = useState("");
  const [role, setRole] = useState("manager");
  const [ownershipPercent, setOwnershipPercent] = useState("25");
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

  const tipoCuenta = String(cuenta?.type || "").toLowerCase();
  const esEmpresa = tipoCuenta === "business" || tipoCuenta === "empresa" || tipoCuenta === "organismo";
  const roleOptions = esEmpresa
    ? [
        { value: "manager", label: "Gestor" },
        { value: "cotitular", label: "Cotitular" },
        { value: "project_owner", label: "Propietario de proyecto" },
      ]
    : [
        { value: "manager", label: "Gestor" },
        { value: "cotitular", label: "Cotitular" },
      ];

  const totalParticipacion = (data || []).reduce((total, item) => total + (Number(item.ownershipPercent ?? item.percent ?? 0) || 0), 0);
  const pendiente = Math.max(0, 100 - totalParticipacion);

  const añadirCotitular = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await api.añadirCotitular({ accountId: cuenta?.id, placetaId, ownershipPercent: Number(ownershipPercent) || 0, role: role || "manager", status: "pending_approval" });
      setPlacetaId("");
      setOwnershipPercent("25");
      setRole("manager");
      setData((await api.gestores(cuenta?.id)).gestores || []);
      setMessage("La solicitud de gestión ha quedado enviada para aceptación en PlacetaID Móvil.");
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
        <div className="ownership-meta"><span>Participación total</span><strong>{totalParticipacion}%</strong></div>
        <div className="ownership-meta"><span>Disponible</span><strong>{pendiente}%</strong></div>
      </Card>

      <Card>
        <SectionTitle title="Añadir gestor o cotitular" subtitle="Se puede añadir una persona, asignarle un porcentaje y pedir su aceptación desde PlacetaID Móvil." className="mb-3" />
        <form onSubmit={añadirCotitular} className="mb-4 grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.7fr_auto]">
          <input required value={placetaId} onChange={(event) => setPlacetaId(event.target.value.toUpperCase())} placeholder="DIP del gestor" className="min-w-0 rounded-xl border border-brand/15 px-3 py-2 text-sm" />
          <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-xl border border-brand/15 bg-white px-3 py-2 text-sm">
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input min="0" max="100" type="number" value={ownershipPercent} onChange={(event) => setOwnershipPercent(event.target.value)} placeholder="%" className="rounded-xl border border-brand/15 px-3 py-2 text-sm" />
          <button disabled={saving || !cuenta?.id} type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "Solicitando…" : "Enviar"}</button>
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
            {data.map((g) => {
              const percent = Number(g.ownershipPercent ?? g.percent ?? 0) || 0;
              const status = String(g.status || g.estado || "active").toLowerCase();
              const pending = status === "pending_approval" || status === "pendiente" || status === "waiting";
              return (
                <li key={g.id || `${g.placetaId || g.displayName}-${g.role}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-brand/10 text-sm font-extrabold text-brand">
                      {(g.displayName || g.placetaId || "?").slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-brand-dark">{g.displayName || g.placetaId}</p>
                      <p className="text-xs text-brand-dark/50">{g.placetaId || g.dip || g.userId || "DIP no disponible"} · {g.accountId || cuenta?.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge tone={pending ? "amber" : "brand"}>{pending ? "Pendiente" : (g.role || "Gestor")}</Badge>
                    {percent > 0 && (
                      <p className="mt-1 text-xs text-brand-dark/50">{percent}%</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
