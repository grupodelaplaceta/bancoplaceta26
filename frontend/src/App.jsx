import { motion } from "framer-motion";
import FluidOrb from "./components/FluidOrb";

const NAV = [
  { group: "Operar", items: ["Inicio", "Movimientos", "Transferencia", "PlaceZUM"] },
  { group: "Cuentas y medios", items: ["Tarjetas", "Gestores", "Inversiones"] },
  { group: "Fiscal y empresa", items: ["Nóminas", "Tributos", "Facturación", "Subvenciones"] },
  { group: "Otros", items: ["Cumplimiento", "Normativa"] },
];

export default function App() {
  return (
    <div className="app-shell">
      <aside
        style={{
          width: 240,
          background: "var(--gdlp-surface)",
          borderRight: "1px solid var(--gdlp-border)",
          padding: "18px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          position: "sticky",
          top: 0,
          height: "100vh",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "0 6px" }}>
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              background: "linear-gradient(135deg, var(--gdlp-primary), var(--gdlp-light))",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
            }}
          >
            B
          </span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Banco de La Placeta</div>
            <div style={{ color: "var(--gdlp-muted)", fontSize: 11.5 }}>Banca en línea</div>
          </div>
        </div>

        {NAV.map((section) => (
          <div key={section.group}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1.1,
                color: "var(--gdlp-textlight)",
                padding: "12px 13px 6px",
              }}
            >
              {section.group}
            </div>
            {section.items.map((item) => (
              <motion.a
                key={item}
                href="#"
                whileHover={{ x: 3 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 13px",
                  borderRadius: 12,
                  color: "var(--gdlp-muted)",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                }}
              >
                {item}
              </motion.a>
            ))}
          </div>
        ))}
      </aside>

      <main style={{ flex: 1, padding: "24px 28px", maxWidth: 1040 }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: "0 0 5px", fontSize: 26, color: "var(--gdlp-dark)" }}>
            Hola, titular 👋
          </h1>
          <p style={{ color: "var(--gdlp-muted)", margin: 0, fontSize: 14 }}>
            Tu saldo, de un vistazo.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: "relative",
            overflow: "hidden",
            background: "linear-gradient(135deg, #22005F 0%, #4D00FF 55%, #7B3DFF 100%)",
            borderRadius: 22,
            padding: "26px 26px 24px",
            color: "#fff",
            minHeight: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.4 }}>
              Saldo total
            </div>
            <div style={{ fontSize: 46, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1, margin: "8px 0" }}>
              1.234 Pz
            </div>
            <div style={{ fontSize: 14, opacity: 0.9 }}>Cuenta principal · GDLP-AP00-000</div>
          </div>
          <FluidOrb size={180} />
        </motion.div>
      </main>
    </div>
  );
}
