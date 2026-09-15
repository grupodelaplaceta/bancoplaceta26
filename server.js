import "dotenv/config";
import express from "express";
import expressLayouts from "express-ejs-layouts";
import path from "path";
import { fileURLToPath } from "url";
import { loginUrl, validateToken } from "./lib/placetaid.js";
import { getToken, setTokenCookie, clearTokenCookie } from "./lib/session.js";
import { webGet, webPost } from "./lib/bancoApi.js";
import { cargarValoresBancarios } from "./lib/bolp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3003;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const CALLBACK_URL = `${APP_URL}/auth/callback`;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));
app.set("layout", "layout");
app.use(expressLayouts);
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Cabeceras de seguridad + no-store (FASE 1.5)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  next();
});

// ── Autenticación ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!getToken(req)) return res.redirect("/login");
  next();
}

app.get("/login", (req, res) => {
  if (getToken(req)) return res.redirect("/");
  res.render("login", { layout: false, loginUrl: loginUrl(CALLBACK_URL), error: req.query.error || null });
});

app.get("/auth/login", (req, res) => res.redirect(loginUrl(CALLBACK_URL)));

app.get("/auth/callback", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect("/login?error=sin_token");
  const validated = await validateToken(token);
  if (!validated) return res.redirect("/login?error=token_invalido");
  setTokenCookie(res, token);
  res.redirect("/");
});

app.post("/auth/logout", (req, res) => {
  clearTokenCookie(res);
  res.redirect("/login");
});

// ── Páginas protegidas (server-side render, solo datos del titular) ─────────
app.get("/", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/cuenta");
  if (r.status === 401) return res.redirect("/login");
  // Un DIP de PlacetaID sin registro bancario se autorregistra (no es un error).
  if (r.status === 404 && r.body?.error === "titular_no_encontrado") return res.redirect("/registro");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudo conectar con el banco en este momento." });
  // Últimos movimientos para el resumen del inicio (igual que la app)
  const mv = await webGet(token, "/api/web/movimientos?limit=8");
  res.render("dashboard", {
    usuario: r.body.usuario,
    cuentas: r.body.cuentas,
    movimientos: (mv.ok && mv.body.movimientos) || [],
    alta: req.query.alta === "1",
    active: "inicio"
  });
});

// ── Alta en el banco con el DIP de PlacetaID ─────────────────────────────
// Cualquier DIP válido puede abrirse cuenta: PlacetaID identifica al titular,
// el backend-banco busca por ese DIP si ya tenía cuentas (y en tal caso solo
// las vincula: nunca se duplican) y solo si no hay nada abre una nueva.
function renderRegistro(res, { consulta, resultado = null, error = null, status = 200 }) {
  return res.status(status).render("registro", {
    layout: false,
    dip: consulta?.dip || null,
    registrado: !!consulta?.registrado,
    yaTeniaCuentas: !!consulta?.yaTeniaCuentas,
    cuentas: consulta?.cuentas || [],
    resultado,
    error
  });
}

app.get("/registro", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/registro");
  if (r.status === 401) return res.redirect("/login");
  renderRegistro(res, {
    consulta: r.ok ? r.body : null,
    error: r.ok ? null : (r.body?.error || "No se pudo consultar tu situación en el banco.")
  });
});

app.post("/registro", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webPost(token, "/api/web/registro", {});
  if (r.status === 401) return res.redirect("/login");
  const consulta = r.ok ? await webGet(token, "/api/web/registro") : null;
  const resultado = r.ok ? r.body.registro : null;
  // Menor de edad: la identidad queda registrada pero la cuenta la abre un tutor.
  if (resultado && !resultado.requiereTutor) return res.redirect("/?alta=1");
  renderRegistro(res, {
    consulta: consulta?.ok ? consulta.body : null,
    resultado,
    error: r.ok ? null : (r.body?.error || "No se pudo completar el alta. Inténtalo de nuevo.")
  });
});

app.get("/movimientos", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/movimientos?limit=200");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudieron cargar los movimientos." });
  res.render("movimientos", { movimientos: r.body.movimientos || [], active: "movimientos" });
});

app.get("/tarjetas", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/tarjetas");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudieron cargar las tarjetas." });
  res.render("tarjetas", { tarjetas: r.body.tarjetas || [], active: "tarjetas" });
});

app.get("/gestores", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/gestores");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudieron cargar los gestores." });
  res.render("gestores", { gestores: r.body.gestores || [], active: "gestores" });
});

app.get("/cumplimiento", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/cumplimiento");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudo cargar el cumplimiento." });
  res.render("cumplimiento", {
    censado: r.body.censado,
    flags: r.body.flags || [],
    cuentas: r.body.cuentas || [],
    active: "cumplimiento"
  });
});

app.get("/transferencia", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/cuenta");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudo cargar tu información." });
  res.render("transferencia", {
    cuentas: r.body.cuentas || [],
    resultado: null,
    error: null,
    active: "transferencia"
  });
});

app.post("/transferencia", requireAuth, async (req, res) => {
  const token = getToken(req);
  const { from, to, cantidad, concepto } = req.body || {};
  const r = await webPost(token, "/api/web/transferencia", {
    from: String(from || "").trim(),
    to: String(to || "").trim(),
    cantidad: Number(cantidad),
    concepto: String(concepto || "").trim()
  });
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) {
    const cuentaR = await webGet(token, "/api/web/cuenta");
    return res.status(200).render("transferencia", {
      cuentas: (cuentaR.ok && cuentaR.body.cuentas) || [],
      resultado: null,
      error: r.body.error || "No se pudo registrar la transferencia.",
      active: "transferencia"
    });
  }
  const cuentaR = await webGet(token, "/api/web/cuenta");
  res.render("transferencia", {
    cuentas: (cuentaR.ok && cuentaR.body.cuentas) || [],
    resultado: r.body.transferencia || r.body,
    error: null,
    active: "transferencia"
  });
});

function ultimosMeses(n) {
  const ahora = new Date();
  const lista = [];
  for (let i = 0; i < (n || 6); i++) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    lista.push({ value, label: value });
  }
  return lista;
}

// ── Valores oficiales (CNI-BANCO) en vivo desde el BOLP ────────────────
// Página informativa: muestra la normativa vigente del Boletín Oficial de
// La Placeta (server-side, sin CORS). Si el BOLP falla, se muestra un aviso
// y la página NO bloquea (no hay cálculos locales en la web).
app.get("/normativa", requireAuth, async (req, res) => {
  const { valores, revision, ok, error } = await cargarValoresBancarios();
  const grupos = new Map();
  (valores || [])
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .forEach((v) => {
      const clave = v.articulo || "CNI-BANCO";
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(v);
    });
  res.render("normativa", {
    grupos: Array.from(grupos, ([articulo, items]) => ({ articulo, items })),
    total: (valores || []).length,
    revision,
    ok,
    error,
    active: "normativa"
  });
});

app.get("/facturacion", requireAuth, async (req, res) => {
  const token = getToken(req);
  const mes = String(req.query.mes || new Date().toISOString().slice(0, 7));
  const r = await webGet(token, `/api/web/facturacion?mes=${encodeURIComponent(mes)}`);
  if (r.status === 401) return res.redirect("/login");
  res.render("facturacion", {
    facturacion: r.ok ? r.body : null,
    error: r.ok ? null : (r.body?.error || "No se pudo cargar la facturación."),
    resultado: null,
    mes,
    meses: ultimosMeses(6),
    active: "facturacion"
  });
});

app.post("/facturacion", requireAuth, async (req, res) => {
  const token = getToken(req);
  const mes = String((req.body || {}).mes || new Date().toISOString().slice(0, 7));
  const facturaIds = [].concat((req.body || {}).facturaIds || []).map(String).filter(Boolean);
  const r = await webPost(token, "/api/web/facturacion/pagar-iva", {
    from: String((req.body || {}).from || "").trim(),
    mes,
    facturaIds
  });
  if (r.status === 401) return res.redirect("/login");
  // Re-render con la facturación actualizada y el resultado/error del pago.
  const fr = await webGet(token, `/api/web/facturacion?mes=${encodeURIComponent(mes)}`);
  res.render("facturacion", {
    facturacion: fr.ok ? fr.body : null,
    resultado: r.ok ? r.body.pago : null,
    error: r.ok ? null : (r.body?.error || "No se pudo ordenar el pago del IVA."),
    mes,
    meses: ultimosMeses(6),
    active: "facturacion"
  });
});

// ── Nóminas (solo lectura: como empleado o empresa) ───────────────────
app.get("/nominas", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/nominas");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudieron cargar las nóminas." });
  res.render("nominas", { n: r.body || {}, active: "nominas" });
});

app.get("/tributos", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/tributos");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudieron cargar tus tributos." });
  res.render("tributos", { t: r.body || {}, active: "tributos" });
});

app.get("/inversiones", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/inversiones");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudieron cargar las inversiones." });
  res.render("inversiones", { inv: r.body || {}, active: "inversiones" });
});

app.get("/subvenciones", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/subvenciones");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudieron cargar las subvenciones." });
  res.render("subvenciones", { s: r.body || {}, active: "subvenciones" });
});

app.get("/placezum", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/cuenta");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudo cargar tu información." });
  res.render("placezum", { cuentas: r.body.cuentas || [], resultado: null, error: null, active: "placezum" });
});

app.post("/placezum", requireAuth, async (req, res) => {
  const token = getToken(req);
  const { from, destinatarios } = req.body || {};
  const lista = String(destinatarios || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const p = l.split(/[,\s]+/);
    return { to: p[0], cantidad: Number(p[1]) };
  }).filter((d) => d.to && d.cantidad > 0);
  const r = await webPost(token, "/api/web/placezum", { from, destinatarios: lista });
  if (r.status === 401) return res.redirect("/login");
  const cuentaR = await webGet(token, "/api/web/cuenta");
  res.render("placezum", {
    cuentas: (cuentaR.ok && cuentaR.body.cuentas) || [],
    resultado: r.ok ? r.body.placezum : null,
    error: r.ok ? null : (r.body.error || "No se pudo registrar el envío PlaceZUM."),
    active: "placezum"
  });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).render("error", { layout: false, mensaje: "Página no encontrada." }));

// Solo escucha si es el servidor local (en Vercel lo hace api/index.js)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║   Banco de La Placeta (web) — Puerto ${PORT}   ║
║   ${APP_URL}                                  ║
║   Login: ${APP_URL}/login                     ║
╚══════════════════════════════════════════════╝
    `);
  });
}

export default app;
