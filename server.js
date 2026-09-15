import "dotenv/config";
import express from "express";
import expressLayouts from "express-ejs-layouts";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { loginUrl, validateToken } from "./lib/placetaid.js";
import { getToken, setTokenCookie, clearTokenCookie, getCuenta, setCuentaCookie } from "./lib/session.js";
import { webGet, webPost, publicPaymentLink } from "./lib/bancoApi.js";
import { cargarValoresBancarios } from "./lib/bolp.js";
import { generarJustificanteDeclaracion } from "./lib/pdfJustificante.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3003;

// En Vercel no se debe construir el login con localhost. APP_URL tiene
// prioridad para dominios propios; después usamos las variables oficiales de
// Vercel y dejamos localhost únicamente para desarrollo local.
function publicOrigin(req = null) {
  const configured = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) return configured;

  const vercelOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercelOrigin) return `https://${String(vercelOrigin).replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  if (req) {
    const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    if (forwardedHost && !/localhost|127\.0\.0\.1/i.test(forwardedHost)) {
      const forwardedProto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
      return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, "");
    }
  }

  return `http://localhost:${PORT}`;
}

function safeReturnTo(value) {
  const candidate = String(value || "").trim();
  return candidate.startsWith("/pagar/") && !candidate.startsWith("//") ? candidate : "/";
}

const APP_URL = publicOrigin();
const CALLBACK_URL = `${APP_URL}/auth/callback`;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));
app.set("layout", "layout");
app.use(expressLayouts);
app.use(express.urlencoded({ extended: true, limit: "64kb" }));
app.use(express.json({ limit: "64kb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: "1h" }));

// Frontend React (rareui) precompilado. Se sirve antes que las rutas EJS para
// que, cuando esté construido, sea la UI principal del banco-web.
const DIST = path.join(__dirname, "frontend", "dist");
const REACT_READY = fs.existsSync(path.join(DIST, "index.html"));
if (REACT_READY) app.use(express.static(DIST, {
  // Los nombres de Vite llevan hash: son inmutables y se pueden cachear.
  maxAge: "1y",
  immutable: true,
  index: false
}));

// Cabeceras de seguridad + no-store (FASE 1.5)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  next();
});

// ── Autenticación ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!getToken(req)) return res.redirect("/login");
  next();
}

// Carga las cuentas del titular y la cuenta activa (para el selector del layout).
async function cargarContexto(req, res, next) {
  const token = getToken(req);
  if (!token) return next();
  try {
    const r = await webGet(token, "/api/web/cuenta");
    if (r.status === 401) return next();
    const cuentas = (r.ok && r.body.cuentas) || [];
    res.locals.cuentas = cuentas;
    res.locals.token = token;
    const sel = getCuenta(req);
    res.locals.cuentaActiva = sel && cuentas.some((c) => c.id === sel) ? sel : (cuentas[0]?.id || null);
  } catch { /* sin contexto */ }
  next();
}
app.use(cargarContexto);

app.post("/cuenta/seleccionar", requireAuth, (req, res) => {
  const cuenta = String((req.body || {}).cuenta || "").trim();
  if (cuenta) setCuentaCookie(res, cuenta);
  res.redirect(String((req.body || {}).volver || "/"));
});

app.get("/login", (req, res) => {
  if (getToken(req)) return res.redirect("/");
  const returnTo = safeReturnTo(req.query.returnTo);
  const callbackUrl = `${publicOrigin(req)}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
  res.render("login", { layout: false, loginUrl: loginUrl(callbackUrl), error: req.query.error || null });
});

app.get("/auth/login", (req, res) => {
  const returnTo = safeReturnTo(req.query.returnTo);
  const callbackUrl = `${publicOrigin(req)}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`;
  res.redirect(loginUrl(callbackUrl));
});

app.get("/auth/callback", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.redirect("/login?error=sin_token");
  const validated = await validateToken(token);
  if (!validated) return res.redirect("/login?error=token_invalido");
  setTokenCookie(res, token);
  res.redirect(safeReturnTo(req.query.returnTo));
});

app.post("/auth/logout", (req, res) => {
  clearTokenCookie(res);
  res.redirect("/login");
});

// ── BFF JSON para el frontend React (misma autenticación por cookie) ──────
// El frontend React (rareui) consume estos endpoints relativos; el token
// PlacetaID se usa solo server-side, igual que en las vistas EJS.
function bff(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (e) {
      console.error("[bff]", e);
      if (!res.headersSent) res.status(500).json({ error: "bff_error" });
    }
  };
}

function bffGet(token, path) {
  return webGet(token, path);
}
function bffPost(token, path, body) {
  return webPost(token, path, body);
}

app.get("/bff/me", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/cuenta");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (r.status === 404 && r.body?.error === "titular_no_encontrado") return res.status(404).json({ error: "titular_no_encontrado" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  const cuentas = r.body.cuentas || [];
  const sel = getCuenta(req);
  const cuentaActiva = sel && cuentas.some((c) => c.id === sel) ? sel : (cuentas[0]?.id || null);
  return res.json({ usuario: r.body.usuario, cuentas, cuentaActiva });
}));

app.get("/bff/movimientos", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const cuenta = String(req.query.cuenta || getCuenta(req) || "");
  const limit = Number(req.query.limit) || 200;
  const q = "?limit=" + encodeURIComponent(limit) + (cuenta ? "&cuenta=" + encodeURIComponent(cuenta) : "");
  const r = await bffGet(token, "/api/web/movimientos" + q);
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/tarjetas", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const cuenta = String(req.query.cuenta || getCuenta(req) || "");
  const r = await bffGet(token, "/api/web/tarjetas" + (cuenta ? "?cuenta=" + encodeURIComponent(cuenta) : ""));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/gestores", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/gestores");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/inversiones", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/inversiones");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/nominas", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/nominas");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/tributos", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/tributos");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/facturacion", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/facturacion");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/subvenciones", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/subvenciones");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/cumplimiento", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/cumplimiento");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(502).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.post("/bff/cuenta/seleccionar", requireAuth, bff(async (req, res) => {
  const cuenta = String((req.body || {}).cuenta || "").trim();
  if (cuenta) setCuentaCookie(res, cuenta);
  return res.json({ ok: true, cuenta });
}));

app.post("/bff/transferencia", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffPost(token, "/api/web/transferencia", req.body || {});
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.status).json(r.body);
}));

app.post("/bff/placezum/codigo", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffPost(token, "/api/web/placezum/codigo", req.body || {});
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.status).json(r.body);
}));

app.post("/bff/placezum/pagar", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffPost(token, "/api/web/placezum/pagar", req.body || {});
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.status).json(r.body);
}));

// Enlaces de pago: consulta pública firmada. No requiere sesión para poder
// revisar el importe y el concepto antes de decidir cómo continuar.
app.get("/pagar/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const signature = String(req.query.signature || "").trim();
  if (!id || !signature) return res.status(400).render("payment-link", { link: null, signature, error: "Este enlace está incompleto o ha sido manipulado." });
  const result = await publicPaymentLink(id, signature);
  if (!result.ok) {
    const status = result.status === 404 ? 404 : (result.status >= 400 && result.status < 500 ? result.status : 502);
    return res.status(status).render("payment-link", { link: null, signature, error: result.body?.message || result.body?.error || "No se pudo verificar este enlace." });
  }
  return res.render("payment-link", { link: result.body.link, signature, error: null });
});

// ── Páginas protegidas (server-side render, solo datos del titular) ─────────
app.get("/", async (req, res, next) => {
  const token = getToken(req);
  if (!token) return res.render("public-home", { layout: false });
  const r = await webGet(token, "/api/web/cuenta");
  if (r.status === 401) return res.redirect("/login");
  // Un DIP de PlacetaID sin registro bancario se autorregistra (no es un error).
  if (r.status === 404 && r.body?.error === "titular_no_encontrado") return res.redirect("/registro");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudo conectar con el banco en este momento." });
  // Últimos movimientos para el resumen del inicio (igual que la app)
  const cuentaActiva = getCuenta(req) || "";
  const mv = await webGet(token, "/api/web/movimientos?limit=8" + (cuentaActiva ? "&cuenta=" + encodeURIComponent(cuentaActiva) : ""));
  res.render("dashboard", {
    usuario: r.body.usuario,
    cuentas: r.body.cuentas,
    movimientos: (mv.ok && mv.body.movimientos) || [],
    alta: req.query.alta === "1",
    active: "inicio"
  });
});


// SPA fallback: cualquier ruta de navegación del frontend sirve index.html.
// Se excluyen login/registro/auth (EJS) y la API/BFF/estáticos.
if (REACT_READY) {
  app.get(/^(?!\/(assets|bff|api|login|auth|registro|cuenta|logout)\b).*/, requireAuth, (req, res) => {
    res.sendFile(path.join(DIST, "index.html"));
  });
}

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
  const cuenta = getCuenta(req) || "";
  const r = await webGet(token, "/api/web/movimientos?limit=200" + (cuenta ? "&cuenta=" + encodeURIComponent(cuenta) : ""));
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { layout: false, mensaje: "No se pudieron cargar los movimientos." });
  res.render("movimientos", { movimientos: r.body.movimientos || [], active: "movimientos" });
});

app.get("/tarjetas", requireAuth, async (req, res) => {
  const token = getToken(req);
  const cuenta = getCuenta(req) || "";
  const r = await webGet(token, "/api/web/tarjetas" + (cuenta ? "?cuenta=" + encodeURIComponent(cuenta) : ""));
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
  res.render("placezum", { cuentas: r.body.cuentas || [], codigo: null, resultado: null, error: null, active: "placezum" });
});

app.post("/placezum/codigo", requireAuth, async (req, res) => {
  const token = getToken(req);
  const { from } = req.body || {};
  const r = await webPost(token, "/api/web/placezum/codigo", { from });
  if (r.status === 401) return res.redirect("/login");
  const cuentaR = await webGet(token, "/api/web/cuenta");
  res.render("placezum", {
    cuentas: (cuentaR.ok && cuentaR.body.cuentas) || [],
    codigo: r.ok ? r.body.codigo : null,
    resultado: null,
    error: r.ok ? null : (r.body.error || "No se pudo generar el código PlaceZUM."),
    active: "placezum"
  });
});

app.post("/placezum/pagar", requireAuth, async (req, res) => {
  const token = getToken(req);
  const { from, codigo, cantidad, concepto } = req.body || {};
  const r = await webPost(token, "/api/web/placezum/pagar", { from, codigo, cantidad: Number(cantidad), concepto });
  if (r.status === 401) return res.redirect("/login");
  const cuentaR = await webGet(token, "/api/web/cuenta");
  res.render("placezum", {
    cuentas: (cuentaR.ok && cuentaR.body.cuentas) || [],
    codigo: null,
    resultado: r.ok ? r.body.placezum : null,
    error: r.ok ? null : (r.body.error || "No se pudo realizar el pago PlaceZUM."),
    active: "placezum"
  });
});

app.get("/tributos/:id/pdf", requireAuth, async (req, res) => {
  const token = getToken(req);
  const [cuentaR, tributosR] = await Promise.all([
    webGet(token, "/api/web/cuenta"),
    webGet(token, "/api/web/tributos")
  ]);
  if (cuentaR.status === 401) return res.redirect("/login");
  const id = req.params.id;
  const all = [...(tributosR.body?.declaraciones || [])];
  for (const emp of tributosR.body?.empresas || []) all.push(...(emp.declaraciones || []));
  const decl = all.find((d) => d.id === id);
  if (!decl) return res.status(404).render("error", { layout: false, mensaje: "Declaración no encontrada." });
  const nombre = cuentaR.body?.usuario?.displayName || cuentaR.body?.usuario?.dip || "Titular";
  const dip = cuentaR.body?.usuario?.dip || "";
  generarJustificanteDeclaracion(res, { nombre, dip, decl });
});

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).render("error", { layout: false, mensaje: "Página no encontrada." }));

// Manejador global de errores: evita crashes por excepciones en rutas async.
app.use((err, req, res, next) => {
  console.error("[banco-web]", err);
  if (res.headersSent) return next(err);
  res.status(500).render("error", { layout: false, mensaje: "Algo salió mal. Inténtalo de nuevo en unos momentos." });
});

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
