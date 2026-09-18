import { useEffect, useMemo, useState } from "react";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { api } from "@/lib/api";

const defaultSales = [
  {
    id: "evt-1042",
    concepto: "Curso de onboarding corporativo",
    cliente: "Fundación La Placeta",
    importe: 1990,
    estado: "Cobrado",
    fecha: "2026-09-12",
  },
  {
    id: "evt-1045",
    concepto: "Producto digital premium",
    cliente: "Proyecto Joven",
    importe: 980,
    estado: "Pendiente",
    fecha: "2026-09-16",
  },
  {
    id: "evt-1051",
    concepto: "Suscripción activa de empresa",
    cliente: "RSP Gestión",
    importe: 1450,
    estado: "Cobrado",
    fecha: "2026-09-17",
  },
];

export default function Ventas({ cuenta }) {
  const [sales, setSales] = useState(defaultSales);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!cuenta) return;
    api
      .ventas(cuenta.id)
      .then((result) => {
        if (!alive) return;
        const list = Array.isArray(result?.ventas)
          ? result.ventas
          : Array.isArray(result?.items)
            ? result.items
            : Array.isArray(result?.data)
              ? result.data
              : defaultSales;
        setSales(list.length ? list : defaultSales);
      })
      .catch(() => {
        if (!alive) return;
        setSales(defaultSales);
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [cuenta?.id]);

  const cuentaLabel = useMemo(
    () => cuenta?.displayName || cuenta?.id || "Cuenta Empresa",
    [cuenta]
  );

  const total = sales.reduce((sum, item) => sum + Number(item.importe || item.amountPz || 0), 0);

  return (
    <div className="workspace-page space-y-6">
      <div className="workspace-heading">
        <SectionTitle
          title="Ventas y productos"
          subtitle={`Control de ingresos de ${cuentaLabel}.`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="eyebrow">Ingresos</p>
          <strong className="mt-2 block text-3xl font-black text-brand-dark">{total.toLocaleString("es-ES")} Pz</strong>
        </Card>
        <Card>
          <p className="eyebrow">Operaciones</p>
          <strong className="mt-2 block text-3xl font-black text-brand-dark">{sales.length}</strong>
        </Card>
        <Card>
          <p className="eyebrow">Cobrado</p>
          <strong className="mt-2 block text-3xl font-black text-brand-dark">
            {sales.filter((item) => String(item.estado || "").toLowerCase() === "cobrado").length}
          </strong>
        </Card>
      </div>

      <Card>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-brand/10" />
            ))}
          </div>
        ) : sales.length === 0 ? (
          <EmptyState title="Sin ventas registradas" hint="Cuando tengas productos o servicios vendidos, aparecerán aquí." />
        ) : (
          <div className="space-y-3">
            {sales.map((venta, index) => {
              const id = venta.id || `venta-${index}`;
              const concepto = venta.concepto || venta.name || venta.title || "Venta de producto";
              const cliente = venta.cliente || venta.customer || venta.account || "Cliente";
              const importe = Number(venta.importe || venta.amountPz || 0);
              const estado = venta.estado || venta.status || "Cobrado";
              const fecha = venta.fecha || venta.createdAt || venta.date || "—";
              return (
                <div key={id} className="rounded-2xl border border-brand/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-brand-dark">{concepto}</p>
                      <p className="text-xs text-brand-dark/55">{cliente}</p>
                    </div>
                    <Badge tone={String(estado).toLowerCase() === "cobrado" ? "green" : "amber"}>{estado}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-brand-dark/50">Importe</p>
                      <p className="text-base font-extrabold text-brand-dark">{importe.toLocaleString("es-ES")} Pz</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-dark/50">Fecha</p>
                      <p className="text-base font-extrabold text-brand-dark">{fecha}</p>
                    </div>
                    <div>
                      <p className="text-xs text-brand-dark/50">Referencia</p>
                      <p className="text-base font-extrabold text-brand-dark">{id}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
