import { useEffect, useMemo, useState } from "react";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { api } from "@/lib/api";

const fallbackCatalogo = [
  {
    id: "cuenta-ahorro",
    title: "Cuenta Ahorro",
    summary: "Ahorro con interés directo del 0,02 % diario y seguimiento claro del saldo.",
    status: "Disponible",
    feature: "0,02 % directo diario",
    tone: "green",
  },
  {
    id: "cuenta-corriente",
    title: "Cuenta Corriente Web",
    summary: "Cuenta operativa para pagos, cobros y gestión desde el canal web del banco.",
    status: "Alta y firma",
    feature: "Pago y cobro diario",
    tone: "brand",
  },
  {
    id: "placetapay-debito",
    title: "PlacetaPay Débito",
    summary: "Tarjeta asociada a la cuenta principal para cierre de compra y uso diario.",
    status: "Preparada",
    feature: "Tarjeta vinculada",
    tone: "amber",
  },
  {
    id: "fondo-inversion",
    title: "Fondo 60s",
    summary: "Inversión temporal con resultado fijado durante 60 segundos y liquidación automática.",
    status: "Activo en cuenta",
    feature: "Rendimiento temporal",
    tone: "rose",
  },
];

export default function Productos({ cuenta }) {
  const [catalogo, setCatalogo] = useState(fallbackCatalogo);
  const [selected, setSelected] = useState(fallbackCatalogo[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!cuenta) return;
    api
      .productos(cuenta.id)
      .then((result) => {
        if (!alive) return;
        const source = Array.isArray(result?.items)
          ? result.items
          : Array.isArray(result?.productos)
            ? result.productos
            : fallbackCatalogo;
        setCatalogo(source.length ? source : fallbackCatalogo);
        setSelected((current) => source.find((item) => item.id === current?.id) || source[0] || fallbackCatalogo[0]);
      })
      .catch(() => {
        if (!alive) return;
        setCatalogo(fallbackCatalogo);
        setSelected(fallbackCatalogo[0]);
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  const cuentaLabel = useMemo(
    () => cuenta?.displayName || cuenta?.id || "Cuenta activa",
    [cuenta]
  );

  return (
    <div className="workspace-page space-y-6">
      <div className="workspace-heading">
        <SectionTitle
          title="Productos y servicios"
          subtitle={`Gestiona tus herramientas activas para ${cuentaLabel}.`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-2xl bg-brand/10" />
              ))}
            </div>
          ) : catalogo.length === 0 ? (
            <EmptyState title="Sin productos" hint="Todavía no hay servicios activos para esta cuenta." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {catalogo.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    selected?.id === item.id
                      ? "border-brand bg-brand/5 shadow-sm shadow-brand/5"
                      : "border-brand/10 bg-white hover:border-brand/30"
                  }`}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <strong className="text-brand-dark">{item.title || item.name || "Producto"}</strong>
                    <Badge tone={item.tone || "brand"}>{item.status || "Disponible"}</Badge>
                  </div>
                  <p className="text-sm text-brand-dark/60">{item.summary || item.description || "Producto disponible para la cuenta."}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-brand/80">
                    {item.feature || item.type || "Servicio bancario"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          {!selected ? (
            <EmptyState title="No hay producto seleccionado" hint="Selecciona uno de la izquierda para ver sus detalles." />
          ) : (
            <>
              <p className="eyebrow">Producto activo</p>
              <h3 className="mt-1 text-xl font-extrabold text-brand-dark">{selected.title || selected.name || "Producto"}</h3>
              <p className="mt-2 text-sm leading-6 text-brand-dark/60">{selected.summary || selected.description || "Producto disponible para esta cuenta."}</p>

              <div className="mt-5 space-y-3 rounded-2xl bg-brand/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-dark/55">Cuenta asociada</span>
                  <strong className="text-sm font-bold text-brand-dark">{cuentaLabel}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-dark/55">Estado</span>
                  <Badge tone={selected.tone || "brand"}>{selected.status || "Disponible"}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-brand-dark/55">Servicio</span>
                  <strong className="text-sm font-bold text-brand-dark">{selected.feature || selected.type || "Servicio bancario"}</strong>
                </div>
              </div>

              <button
                type="button"
                className="mt-5 w-full rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white"
                onClick={() => window.location.hash = "apertura"}
              >
                Solicitar alta de producto
              </button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
