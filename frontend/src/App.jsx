import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import FluidOrb from "@/components/FluidOrb";
import NotificationBell from "@/components/NotificationBell";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import Dashboard from "@/pages/Dashboard";
import Movimientos from "@/pages/Movimientos";
import Transferencia from "@/pages/Transferencia";
import Placezum from "@/pages/Placezum";
import Tarjetas from "@/pages/Tarjetas";
import Gestores from "@/pages/Gestores";
import Inversiones from "@/pages/Inversiones";
import Nominas from "@/pages/Nominas";
import Tributos from "@/pages/Tributos";
import Facturacion from "@/pages/Facturacion";
import Subvenciones from "@/pages/Subvenciones";
import Cumplimiento from "@/pages/Cumplimiento";
import Normativa from "@/pages/Normativa";

const NAV = [
  { group: "Operar", items: [
    { id: "inicio", label: "Inicio" },
    { id: "movimientos", label: "Movimientos" },
    { id: "transferencia", label: "Transferencia" },
    { id: "placezum", label: "PlaceZUM" },
  ]},
  { group: "Cuentas y medios", items: [
    { id: "tarjetas", label: "Tarjetas" },
    { id: "gestores", label: "Gestores" },
    { id: "inversiones", label: "Inversiones" },
  ]},
  { group: "Fiscal y empresa", items: [
    { id: "nominas", label: "Nóminas" },
    { id: "tributos", label: "Tributos" },
    { id: "facturacion", label: "Facturación" },
    { id: "subvenciones", label: "Subvenciones" },
  ]},
  { group: "Otros", items: [
    { id: "cumplimiento", label: "Cumplimiento" },
    { id: "normativa", label: "Normativa" },
  ]},
];

const PAGES = {
  inicio: Dashboard,
  movimientos: Movimientos,
  transferencia: Transferencia,
  placezum: Placezum,
  tarjetas: Tarjetas,
  gestores: Gestores,
  inversiones: Inversiones,
  nominas: Nominas,
  tributos: Tributos,
  facturacion: Facturacion,
  subvenciones: Subvenciones,
  cumplimiento: Cumplimiento,
  normativa: Normativa,
};

function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace("#", "") || "inicio");
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.replace("#", "") || "inicio");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return route;
}

export default function App() {
  const route = useHashRoute();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [cuentaId, setCuentaId] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((r) => {
        if (!alive) return;
        setMe(r);
        setCuentaId(r.cuentaActiva || r.cuentas?.[0]?.id || null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const cuenta = useMemo(
    () => (me?.cuentas || []).find((c) => c.id === cuentaId) || me?.cuentas?.[0] || null,
    [me, cuentaId]
  );

  const seleccionarCuenta = async (id) => {
    setCuentaId(id);
    try {
      await api.seleccionarCuenta(id);
    } catch {
      /* la cookie es opcional: si falla seguimos con la selección local */
    }
  };

  const Page = PAGES[route] || Dashboard;

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md rounded-3xl border border-brand/10 bg-white p-8 text-center shadow-lg shadow-brand/5">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <h1 className="text-xl font-extrabold text-brand-dark">No se pudo conectar</h1>
          <p className="mt-2 text-sm text-brand-dark/60">{error}</p>
          <a href="/login" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white">
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 overflow-hidden rounded-full">
            <FluidOrb size={64} color="#4D00FF" />
          </div>
          <Spinner className="!h-8 !w-8" />
          <p className="text-sm font-semibold text-brand-dark/60">Cargando tu banco…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-light font-extrabold text-white">
            B
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold text-brand-dark">Banco de La Placeta</p>
            <p className="text-[11px] text-brand-dark/50">Banca en línea</p>
          </div>
        </div>

        <div className="account-selector">
          <label className="label">Cuenta activa</label>
          <select
            value={cuenta?.id || ""}
            onChange={(e) => seleccionarCuenta(e.target.value)}
            className="w-full rounded-xl border-2 border-brand/15 bg-white px-3 py-2.5 text-sm font-semibold text-brand-dark outline-none focus:border-brand"
          >
            {(me.cuentas || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName} · {c.id}
              </option>
            ))}
          </select>
        </div>

        <nav className="nav">
          {NAV.map((section) => (
            <div key={section.group} className="mb-1">
              <p className="nav-group">{section.group}</p>
              {section.items.map((item) => {
                const active = route === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className={"nav-item " + (active ? "nav-item-active" : "")}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-dot"
                        className="nav-dot"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    {item.label}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <h1 className="text-2xl font-extrabold text-brand-dark">
              Hola, {me.usuario?.displayName?.split(" ")[0] || "titular"} 👋
            </h1>
            <p className="text-sm text-brand-dark/55">
              {cuenta?.displayName || "Cuenta"} · {cuenta?.id || "—"}
            </p>
          </div>
          <NotificationBell />
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <Page cuenta={cuenta} cuentas={me.cuentas || []} me={me} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
