import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "@/components/Icon";
import NotificationBell from "@/components/NotificationBell";
import ProductLauncher from "@/components/ProductLauncher";
import { Spinner } from "@/components/ui";
import { api } from "@/lib/api";

// Las pantallas se descargan solo cuando se abren: el primer render carga
// únicamente el dashboard y el shell de navegación.
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Movimientos = lazy(() => import("@/pages/Movimientos"));
const Transferencia = lazy(() => import("@/pages/Transferencia"));
const Placezum = lazy(() => import("@/pages/Placezum"));
const Tarjetas = lazy(() => import("@/pages/Tarjetas"));
const Gestores = lazy(() => import("@/pages/Gestores"));
const Inversiones = lazy(() => import("@/pages/Inversiones"));
const Nominas = lazy(() => import("@/pages/Nominas"));
const Tributos = lazy(() => import("@/pages/Tributos"));
const Facturacion = lazy(() => import("@/pages/Facturacion"));
const Subvenciones = lazy(() => import("@/pages/Subvenciones"));
const Cumplimiento = lazy(() => import("@/pages/Cumplimiento"));
const Normativa = lazy(() => import("@/pages/Normativa"));
const AperturaCuenta = lazy(() => import("@/pages/AperturaCuenta"));
const Productos = lazy(() => import("@/pages/Productos"));
const Ventas = lazy(() => import("@/pages/Ventas"));

const BASE_NAV = [
  { group: "Operar", items: [
    { id: "inicio", label: "Inicio", icon: "home" },
    { id: "movimientos", label: "Movimientos", icon: "activity" },
    { id: "transferencia", label: "Transferencia", icon: "send" },
    { id: "placezum", label: "PlaceZUM", icon: "zum" },
  ]},
  { group: "Cuentas y medios", items: [
    { id: "tarjetas", label: "Tarjetas", icon: "card" },
    { id: "gestores", label: "Gestores", icon: "users" },
    { id: "inversiones", label: "Inversiones", icon: "chart" },
  ]},
  { group: "Fiscal y empresa", items: [
    { id: "tributos", label: "Tributos", icon: "receipt" },
    { id: "facturacion", label: "Facturación", icon: "building" },
    { id: "nominas", label: "Nóminas", icon: "receipt" },
    { id: "subvenciones", label: "Subvenciones", icon: "chart" },
  ]},
  { group: "Otros", items: [
    { id: "cumplimiento", label: "Cumplimiento", icon: "shield" },
    { id: "normativa", label: "Normativa", icon: "book" },
  ]},
];

function formatAccountIdentity(cuenta) {
  if (!cuenta) return "Cuenta activa";
  const label = [cuenta.displayName, cuenta.iban, cuenta.eip, cuenta.dip, cuenta.titularDip]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  return label || cuenta.id || "Cuenta activa";
}

const PAGES = {
  inicio: Dashboard,
  apertura: AperturaCuenta,
  movimientos: Movimientos,
  transferencia: Transferencia,
  placezum: Placezum,
  tarjetas: Tarjetas,
  gestores: Gestores,
  inversiones: Inversiones,
  nominas: Nominas,
  tributos: Tributos,
  facturacion: Facturacion,
  productos: Productos,
  ventas: Ventas,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cuentaId, setCuentaId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .me()
      .then((r) => {
        if (!alive) return;
        setMe(r);
        setCuentaId(r.cuentaActiva || r.cuentas?.[0]?.id || null);
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
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
    if (route !== "inicio") window.location.hash = "inicio";
    try {
      await api.seleccionarCuenta(id);
    } catch {
      /* la cookie es opcional: si falla seguimos con la selección local */
    }
  };

  const tipoCuenta = String(cuenta?.type || "").toLowerCase();
  const cuentaJunior = tipoCuenta === "junior" || tipoCuenta.includes("juvenil");
  const cuentaEmpresa = ["business", "empresa", "organismo", "state"].includes(tipoCuenta);
  const cuentaInversion = ["investment", "inversion"].includes(tipoCuenta);
  const inversionesPermitidas = cuentaInversion || cuentaEmpresa || Boolean(cuenta?.eip);
  const navVisible = useMemo(() => {
    let visible = BASE_NAV;

    if (cuentaJunior) {
      visible = BASE_NAV.map((section) => ({
        ...section,
        items: section.items.filter((item) => ["inicio", "movimientos", "transferencia", "placezum", "normativa"].includes(item.id))
      })).filter((section) => section.items.length);
    }

    if (cuentaEmpresa) {
      visible = BASE_NAV.map((section) => ({
        ...section,
        items: section.items.filter((item) => !["tributos", "facturacion", "apertura"].includes(item.id))
      })).filter((section) => section.items.length);

      const empresaSection = visible.find((section) => section.group === "Cuentas y medios");
      if (empresaSection) {
        empresaSection.items.push(
          { id: "productos", label: "Productos", icon: "chip" },
          { id: "ventas", label: "Ventas", icon: "receipt" }
        );
      }
    }

    if (!inversionesPermitidas) {
      visible = visible.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.id !== "inversiones")
      })).filter((section) => section.items.length);
    }

    return visible;
  }, [cuentaJunior, cuentaEmpresa, inversionesPermitidas]);
  const currentItem = navVisible.flatMap((section) => section.items).find((item) => item.id === route);
  const activeRoute = currentItem ? route : "inicio";
  const Page = PAGES[activeRoute] || Dashboard;

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
      <div className="app-loading-screen" role="status" aria-live="polite">
        <div className="app-loading-panel">
          <div className="brand-loading-mark" aria-label="Banco de La Placeta">
            <img src="/img/bancologosobreoscuro.png" alt="Banco de La Placeta" />
          </div>
          {loading ? <><Spinner className="!h-8 !w-8" /><p>Cargando tu banco…</p></> : <button type="button" className="loading-retry" onClick={() => window.location.reload()}>Reintentar conexión</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <button
        type="button"
        className="mobile-menu-button"
        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        <Icon name={menuOpen ? "close" : "menu"} size={21} />
      </button>
      {menuOpen && <button type="button" className="mobile-scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="app-brand-logo-wrap">
          <img className="app-brand-logo" src="/img/logobancosobreblanco.png" alt="Banco de La Placeta" />
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
                {formatAccountIdentity(c)}
              </option>
            ))}
          </select>
        </div>

        <nav className="nav">
          {navVisible.map((section) => (
            <div key={section.group} className="mb-1">
              <p className="nav-group">{section.group}</p>
              {section.items.map((item) => {
                const active = route === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className={"nav-item " + (active ? "nav-item-active" : "")}
                  >
                    <Icon name={item.icon} size={17} />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main className={`main ${cuentaEmpresa ? "account-mode-company" : cuentaJunior ? "account-mode-junior" : "account-mode-personal"}`}>
        <header className="header">
          <div>
            <p className="eyebrow">{currentItem?.label || "Banco de La Placeta"}</p>
            <h1 className="text-2xl font-extrabold text-brand-dark">
              Hola, {me.usuario?.displayName?.split(" ")[0] || "titular"} 👋
            </h1>
            <p className="text-sm text-brand-dark/55">
              {formatAccountIdentity(cuenta)}
            </p>
          </div>
          <NotificationBell />
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={route}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            <Suspense fallback={<div className="page-loading"><Spinner /><span>Cargando sección…</span></div>}>
              <Page cuenta={cuenta} cuentas={me.cuentas || []} me={me} />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <ProductLauncher cuenta={cuenta} />
    </div>
  );
}
