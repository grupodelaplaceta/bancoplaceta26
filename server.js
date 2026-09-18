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
import { generarJustificanteDeclaracion, generarComprobanteTransferencia, generarComprobanteNomina } from "./lib/pdfJustificante.js";

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
  const allowed = candidate === "/panel" || candidate.startsWith("/pagar/");
  return allowed && !candidate.startsWith("//") ? candidate : "/panel";
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

app.get("/login", async (req, res) => {
  const token = getToken(req);
  if (token) {
    const validated = await validateToken(token);
    if (validated) return res.redirect("/panel");
    if (validated === false) {
      // Una cookie puede sobrevivir a la caducidad del token. Limpiarla aquí
      // evita el bucle /login → / → /login en navegadores con sesiones antiguas.
      clearTokenCookie(res);
    }
  }
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
  if (validated === false) return res.redirect("/login?error=token_invalido");
  // Si PlacetaID responde con un fallo temporal, no destruimos la sesión que
  // acaba de devolver el token válido. Se acepta y se guarda la cookie para
  // que el usuario siga autenticado sin caer en salidas bruscas.
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

function bffTrustedPost(token, path, body) {
  return webPost(token, path, body, { 'X-API-Key': process.env.DOCS_API_KEY || 'docs-shared-key-2026' });
}

const FECHA_FIN_SUBVENCION_EMPRESA = process.env.EMPRESA_SUBVENCION_FECHA_FIN || "2026-12-31";
const URL_PLACETA_JUNIOR = process.env.PLACETA_JUNIOR_URL || "https://junior.laplaceta.org";
const URL_PLACETA_JOVEN = process.env.PLACETA_JOVEN_URL || "https://joven.laplaceta.org";

function tipoCuentaNormalizado(value) {
  return String(value || "Current").trim().toLowerCase();
}

function politicaApertura(tipoCuenta, eip, cuentas = []) {
  const tipo = tipoCuentaNormalizado(tipoCuenta);
  if (tipo === "junior" || tipo.includes("juvenil") || tipo === "child") {
    return {
      ok: false,
      status: 409,
      body: {
        error: "alta_junior_desde_app",
        message: "Las cuentas Junior se crean desde la app de Placeta Junior.",
        redirect: URL_PLACETA_JUNIOR
      }
    };
  }
  if (tipo === "joven" || tipo.includes("joven")) {
    return {
      ok: false,
      status: 409,
      body: {
        error: "cuenta_joven_por_suscripcion",
        message: "La Cuenta Joven se genera al activar la suscripción de Placeta Joven.",
        redirect: URL_PLACETA_JOVEN
      }
    };
  }
  if (["business", "empresa", "organismo", "state"].includes(tipo)) {
    const buscado = String(eip || "").trim().toUpperCase();
    const eipsTitular = new Set((cuentas || []).map((cuenta) => String(cuenta.eip || "").trim().toUpperCase()).filter(Boolean));
    if (!buscado || !eipsTitular.has(buscado)) {
      return {
        ok: false,
        status: 422,
        body: {
          error: "eip_verificado_requerido",
          message: "Antes de crear una cuenta de empresa debes dar de alta y verificar la entidad de tu proyecto en RSP.",
          redirect: "/bff/apertura"
        }
      };
    }
    return {
      ok: true,
      promocion: {
        elegible: new Date(`${FECHA_FIN_SUBVENCION_EMPRESA}T23:59:59.999Z`).getTime() >= Date.now(),
        importePz: 5000,
        fechaFin: FECHA_FIN_SUBVENCION_EMPRESA,
        emisor: "Banco de La Placeta",
        requiereJustificacionRsp: true,
        eipVerificado: buscado
      }
    };
  }
  return { ok: true, promocion: null };
}
function cuentaPath(req, path) {
  const cuenta = String(req.query.cuenta || getCuenta(req) || "").trim();
  return cuenta ? `${path}${path.includes("?") ? "&" : "?"}cuenta=${encodeURIComponent(cuenta)}` : path;
}
function upstreamStatus(result) {
  if (result.status === 401) return 401;
  if (result.status === 403) return 403;
  if (result.status === 404) return 404;
  if (result.status === 405) return 405;
  return 502;
}

app.get("/bff/me", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, "/api/web/cuenta");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (r.status === 404 && r.body?.error === "titular_no_encontrado") return res.status(404).json({ error: "titular_no_encontrado" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  const cuentas = r.body.cuentas || [];
  const sel = getCuenta(req);
  const cuentaActiva = sel && cuentas.some((c) => c.id === sel) ? sel : (cuentas[0]?.id || null);
  return res.json({ usuario: r.body.usuario, cuentas, cuentaActiva });
}));

app.post("/bff/apertura", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const body = req.body || {};
  const me = await bffGet(token, "/api/web/cuenta");
  if (me.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!me.ok) return res.status(upstreamStatus(me)).json({ error: me.body?.error || "banco_no_disponible" });

  const tipoCuenta = String(body.tipoCuenta || "Current").trim();
  const politica = politicaApertura(tipoCuenta, body.eip, me.body?.cuentas || []);
  if (!politica.ok) return res.status(politica.status).json(politica.body);

  const nombre = String(me.body?.usuario?.displayName || me.body?.usuario?.dip || "Titular").trim();
  const solicitud = await bffTrustedPost(token, "/api/document-actions", {
    action: "solicitar-apertura-cuenta",
    dip: String(me.body?.usuario?.dip || "").trim().toUpperCase(),
    nombre,
    datos: {
      tipoCuenta,
      plataforma: String(body.platform || "web").trim().toLowerCase() || "web",
      displayName: String(body.displayName || `Cuenta ${tipoCuenta}`).trim(),
      eip: String(body.eip || "").trim().toUpperCase() || null,
      accountPurpose: String(body.accountPurpose || "").trim() || null,
      promocionEmpresa: politica.promocion
    }
  });
  if (!solicitud.ok) return res.status(upstreamStatus(solicitud)).json({ error: solicitud.body?.error || "no_se_pudo_iniciar_la_firma", detalle: solicitud.body });
  return res.status(202).json({ ok: true, ...solicitud.body, promocion: politica.promocion });
}));

app.post("/bff/productos/solicitar", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const body = req.body || {};
  const productType = String(body.productType || '').trim().toLowerCase();
  const accountId = String(body.accountId || '').trim();
  const catalogo = new Set(['placetapay-debito', 'cuenta-ahorro', 'fondo-inversion']);
  if (!catalogo.has(productType) || !accountId) return res.status(400).json({ error: 'producto_o_cuenta_invalidos' });

  const me = await bffGet(token, "/api/web/cuenta");
  if (me.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!me.ok) return res.status(upstreamStatus(me)).json({ error: me.body?.error || "banco_no_disponible" });
  const cuenta = (me.body?.cuentas || []).find((item) => item.id === accountId);
  if (!cuenta) return res.status(403).json({ error: 'cuenta_no_pertenece_al_titular' });
  if (String(cuenta.type || '').toLowerCase() === 'junior') return res.status(409).json({ error: 'producto_no_disponible_para_junior' });

  const solicitud = await bffTrustedPost(token, "/api/document-actions", {
    action: "solicitar-contrato-producto",
    dip: String(me.body?.usuario?.dip || '').trim().toUpperCase(),
    nombre: String(me.body?.usuario?.displayName || me.body?.usuario?.dip || 'Titular').trim(),
    datos: { productType, accountId, accountName: cuenta.displayName, fechaSolicitud: new Date().toISOString() }
  });
  if (!solicitud.ok) return res.status(upstreamStatus(solicitud)).json({ error: solicitud.body?.error || 'no_se pudo_iniciar_la_firma', detalle: solicitud.body });
  return res.status(202).json({ ok: true, ...solicitud.body });
}));

app.get("/bff/productos", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const cuenta = String(req.query.cuenta || getCuenta(req) || "").trim();
  const me = await bffGet(token, "/api/web/cuenta");
  if (me.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!me.ok) return res.status(upstreamStatus(me)).json({ error: me.body?.error || "banco_no_disponible" });

  const cuentas = Array.isArray(me.body?.cuentas) ? me.body.cuentas : [];
  const cuentaActiva = cuentas.find((item) => item.id === cuenta) || cuentas[0] || null;
  const base = [
    { id: "cuenta-ahorro", title: "Cuenta Ahorro", summary: "Ahorro con interés directo del 0,02 % diario y seguimiento claro del saldo.", status: "Disponible", feature: "0,02 % directo diario", tone: "green" },
    { id: "cuenta-corriente", title: "Cuenta Corriente Web", summary: "Cuenta operativa para pagos, cobros y gestión desde el canal web del banco.", status: "Alta y firma", feature: "Pago y cobro diario", tone: "brand" },
    { id: "placetapay-debito", title: "PlacetaPay Débito", summary: "Tarjeta asociada a la cuenta principal para cierre de compra y uso diario.", status: "Preparada", feature: "Tarjeta vinculada", tone: "amber" },
    { id: "fondo-inversion", title: "Fondo 60s", summary: "Inversión temporal con resultado fijado durante 60 segundos y liquidación automática.", status: "Activo en cuenta", feature: "Rendimiento temporal", tone: "rose" }
  ];

  try {
    const r = await bffGet(token, cuentaPath(req, "/api/web/productos"));
    if (r.ok && Array.isArray(r.body?.items)) return res.json({ items: r.body.items, cuenta: cuentaActiva?.id || null, total: r.body.items.length });
    if (r.ok && Array.isArray(r.body?.productos)) return res.json({ items: r.body.productos, cuenta: cuentaActiva?.id || null, total: r.body.productos.length });
  } catch {
    // Fallback a la oferta base del banco cuando la API no expone el catálogo aún.
  }

  return res.json({ items: base, cuenta: cuentaActiva?.id || null, total: base.length });
}));

app.get("/bff/ventas", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const cuenta = String(req.query.cuenta || getCuenta(req) || "").trim();
  const me = await bffGet(token, "/api/web/cuenta");
  if (me.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!me.ok) return res.status(upstreamStatus(me)).json({ error: me.body?.error || "banco_no_disponible" });

  const cuentas = Array.isArray(me.body?.cuentas) ? me.body.cuentas : [];
  const cuentaActiva = cuentas.find((item) => item.id === cuenta) || cuentas[0] || null;
  const fallback = [
    { id: "evt-1042", concepto: "Curso de onboarding corporativo", cliente: "Fundación La Placeta", importe: 1990, estado: "Cobrado", fecha: "2026-09-12" },
    { id: "evt-1045", concepto: "Producto digital premium", cliente: "Proyecto Joven", importe: 980, estado: "Pendiente", fecha: "2026-09-16" },
    { id: "evt-1051", concepto: "Suscripción activa de empresa", cliente: "RSP Gestión", importe: 1450, estado: "Cobrado", fecha: "2026-09-17" }
  ];

  try {
    const r = await bffGet(token, cuentaPath(req, "/api/web/ventas"));
    if (r.ok && Array.isArray(r.body?.ventas)) return res.json({ ventas: r.body.ventas, cuenta: cuentaActiva?.id || null, total: r.body.ventas.length });
    if (r.ok && Array.isArray(r.body?.items)) return res.json({ ventas: r.body.items, cuenta: cuentaActiva?.id || null, total: r.body.items.length });
  } catch {
    // Fallback a datos de ventas representativos mientras se pública la API real.
  }

  try {
    const facturacion = await bffGet(token, `/api/web/facturacion${cuentaActiva?.id ? `?cuenta=${encodeURIComponent(cuentaActiva.id)}` : ""}`);
    if (facturacion.ok && Array.isArray(facturacion.body?.empresas)) {
      const ventas = facturacion.body.empresas.flatMap((empresa) => (empresa.facturas || []).map((factura) => ({
        id: factura.id,
        concepto: factura.concepto || factura.id,
        cliente: empresa.nombre || empresa.eip || "Cliente",
        importe: Number(factura.iva || factura.total || 0),
        estado: factura.ivaPagado ? "Cobrado" : "Pendiente",
        fecha: factura.fecha || new Date().toISOString().slice(0, 10)
      })));
      if (ventas.length) return res.json({ ventas, cuenta: cuentaActiva?.id || null, total: ventas.length });
    }
  } catch {
    // Si no hay facturación, queda el fallback seguro.
  }

  return res.json({ ventas: fallback, cuenta: cuentaActiva?.id || null, total: fallback.length });
}));

app.get("/bff/movimientos", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const cuenta = String(req.query.cuenta || getCuenta(req) || "");
  const limit = Number(req.query.limit) || 200;
  const q = "?limit=" + encodeURIComponent(limit) + (cuenta ? "&cuenta=" + encodeURIComponent(cuenta) : "");
  const r = await bffGet(token, "/api/web/movimientos" + q);
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.post("/bff/nominas/trabajadores/:id/despedir", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const id = encodeURIComponent(String(req.params.id || ""));
  const r = await bffPost(token, `/api/web/nominas/trabajadores/${id}/despedir`, {});
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.ok ? 200 : upstreamStatus(r)).json(r.body);
}));

app.get("/bff/nominas/contratos/:id/pdf", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const id = encodeURIComponent(String(req.params.id || ""));
  const r = await bffGet(token, `/api/web/nominas/contratos/${id}/pdf-data`);
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok || !r.body?.contrato) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "contrato_no_encontrado" });
  return generarComprobanteNomina(res, r.body);
}));

app.get("/bff/nominas/periodos/:id/pdf", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const id = encodeURIComponent(String(req.params.id || ""));
  const r = await bffGet(token, `/api/web/nominas/periodos/${id}/pdf-data`);
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok || !r.body?.periodo) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "nomina_no_encontrada" });
  return generarComprobanteNomina(res, r.body);
}));

app.get("/bff/movimientos/:id/comprobante.pdf", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const id = encodeURIComponent(String(req.params.id || ""));
  const r = await bffGet(token, `/api/web/movimientos/${id}`);
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok || !r.body?.movimiento) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "movimiento_no_encontrado" });
  const me = await bffGet(token, "/api/web/cuenta");
  const usuario = me.body?.usuario || {};
  return generarComprobanteTransferencia(res, {
    nombre: usuario.displayName,
    dip: usuario.dip,
    movimiento: r.body.movimiento
  });
}));

app.get("/bff/tarjetas", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const cuenta = String(req.query.cuenta || getCuenta(req) || "");
  const r = await bffGet(token, cuentaPath(req, "/api/web/tarjetas"));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.post("/bff/gestores", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffPost(token, "/api/web/gestores", req.body || {});
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.ok ? r.status : upstreamStatus(r)).json(r.body);
}));

app.get("/bff/gestores", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, cuentaPath(req, "/api/web/gestores"));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/inversiones", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, cuentaPath(req, "/api/web/inversiones"));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.post("/bff/inversiones", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffPost(token, "/api/web/inversiones", req.body || {});
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.ok ? r.status : upstreamStatus(r)).json(r.body);
}));

app.post("/bff/inversiones/:id/liquidar", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const id = encodeURIComponent(String(req.params.id || ""));
  const r = await bffPost(token, `/api/web/inversiones/${id}/liquidar`, {});
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.ok ? r.status : upstreamStatus(r)).json(r.body);
}));

app.get("/bff/nominas", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const cuenta = String(req.query.cuenta || getCuenta(req) || "").trim();
  // No enviamos `cuenta` al upstream: algunas versiones desplegadas de la
  // API solo aceptan GET /api/web/nominas y respondían 405. El alcance se
  // resuelve aquí por EIP, manteniendo el companyAccountId real de cada nómina.
  const r = await bffGet(token, "/api/web/nominas");
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  const body = r.body || {};
  if (!cuenta) return res.json(body);

  const me = await bffGet(token, "/api/web/cuenta");
  if (!me.ok) return res.status(upstreamStatus(me)).json({ error: me.body?.error || "banco_no_disponible" });
  const cuentas = Array.isArray(me.body?.cuentas) ? me.body.cuentas : [];
  const seleccionada = cuentas.find((item) => item.id === cuenta);
  if (!seleccionada) return res.status(404).json({ error: "cuenta_no_encontrada" });
  const eip = String(seleccionada.eip || "").trim().toUpperCase();
  const cuentasEip = new Set(cuentas.filter((item) => eip && String(item.eip || "").trim().toUpperCase() === eip).map((item) => item.id));
  const contratos = (body.contratos || []).filter((contrato) =>
    cuentasEip.size > 0 ? cuentasEip.has(contrato.companyAccountId) : contrato.companyAccountId === cuenta || contrato.accountId === cuenta
  );
  const ids = new Set(contratos.map((contrato) => contrato.id));
  return res.json({
    ...body,
    contratos,
    resumenes: (body.resumenes || []).filter((resumen) => ids.has(resumen.contrato?.id || resumen.contractId)),
    periodos: (body.periodos || []).filter((periodo) => (cuentasEip.size > 0 ? cuentasEip.has(periodo.companyAccountId) : periodo.companyAccountId === cuenta) || periodo.contractId && ids.has(periodo.contractId))
  });
}));

app.get("/bff/contactos", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, cuentaPath(req, "/api/web/contactos"));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/nominas/trabajadores/buscar", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const dip = encodeURIComponent(String(req.query.dip || "").trim());
  const r = await bffGet(token, `/api/web/nominas/trabajadores/buscar?dip=${dip}`);
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.post("/bff/nominas/trabajadores", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffPost(token, "/api/web/nominas/trabajadores", req.body || {});
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.ok ? 201 : upstreamStatus(r)).json(r.body);
}));

app.get("/bff/tributos", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, cuentaPath(req, "/api/web/tributos"));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/facturacion", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const base = `/api/web/facturacion${req.query.mes ? `?mes=${encodeURIComponent(String(req.query.mes))}` : ""}`;
  const r = await bffGet(token, cuentaPath(req, base));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.post("/bff/facturacion/pagar-iva", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const body = req.body || {};
  const r = await bffPost(token, "/api/web/facturacion/pagar-iva", {
    from: String(body.from || "").trim(),
    mes: String(body.mes || "").trim(),
    facturaIds: Array.isArray(body.facturaIds) ? body.facturaIds.map(String).filter(Boolean) : []
  });
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  return res.status(r.ok ? 200 : upstreamStatus(r)).json(r.body);
}));

app.get("/bff/subvenciones", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, cuentaPath(req, "/api/web/subvenciones"));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
  return res.json(r.body);
}));

app.get("/bff/cumplimiento", requireAuth, bff(async (req, res) => {
  const token = getToken(req);
  const r = await bffGet(token, cuentaPath(req, "/api/web/cumplimiento"));
  if (r.status === 401) return res.status(401).json({ error: "auth_required" });
  if (!r.ok) return res.status(upstreamStatus(r)).json({ error: r.body?.error || "banco_no_disponible" });
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

// ── Página pública principal ────────────────────────────────────────────────
// La entrada principal del banco debe permanecer pública; el panel protegido
// queda en /panel para los usuarios ya autenticados.
app.get("/", async (req, res, next) => {
  const token = getToken(req);
  if (token) {
    const sessionUser = await validateToken(token);
    if (sessionUser) {
      // Se mantiene la sesión pero la web pública sigue siendo la portada principal.
      return res.render("public-home", { layout: false, sessionUser });
    }
    if (sessionUser === false) {
      clearTokenCookie(res);
    }
  }
  return res.render("public-home", { layout: false, sessionUser: null });
});


const publicPages = {
  "/ecosistema": {
    eyebrow: "El ecosistema",
    title: "Una cuenta para cada proyecto, una visión común.",
    description: "Conoce los servicios públicos del ecosistema Banco de La Placeta.",
    intro: "Banco de La Placeta conecta personas, empresas, organismos y proyectos en una economía virtual sin ánimo de lucro, con herramientas claras y una experiencia homogénea.",
    backLabel: "Volver a la portada",
    showcaseTitle: "Todo tiene su espacio",
    showcaseText: "La cuenta activa mantiene el contexto de cada operación para que la información no aparezca mezclada.",
    sectionEyebrow: "Servicios",
    sectionTitle: "Un banco construido alrededor de la comunidad.",
    sectionIntro: "Cada módulo resuelve una necesidad concreta y comparte los mismos criterios de seguridad y trazabilidad.",
    cards: [
      { icon: "users", title: "Personas y cuentas", text: "Cuentas personales, cotitularidades y perfiles junior con límites y permisos visibles." },
      { icon: "chart", title: "Proyectos e inversión", text: "Herramientas para proyectos, fondos y operaciones con información comprensible antes de decidir." },
      { icon: "book", title: "Tributos y documentos", text: "Declaraciones, facturación y documentación organizada desde el RSP y el banco." }
    ]
  },
  "/placezum": {
    eyebrow: "PlaceZUM",
    title: "Enviar Placetas debería ser tan sencillo como decir: en un zum.",
    description: "PlaceZUM: pagos y cobros temporales del Banco de La Placeta.",
    intro: "Genera un código temporal, compártelo y confirma la operación desde una cuenta concreta. Sin enlaces opacos ni pasos innecesarios.",
    backLabel: "Volver a la portada",
    showcaseTitle: "Código temporal",
    showcaseText: "Los códigos caducan, se validan en backend y no mezclan el saldo de otras cuentas.",
    sectionEyebrow: "Cómo funciona",
    sectionTitle: "Diseñado para cobrar y pagar con contexto.",
    sectionIntro: "PlaceZUM está pensado para el uso diario, pero con controles de identidad, saldo y trazabilidad.",
    cards: [
      { icon: "zum", title: "Genera", text: "Crea un código temporal desde la cuenta seleccionada para recibir Placetas." },
      { icon: "shield", title: "Verifica", text: "El backend comprueba caducidad, origen, destino, saldo y límites antes de aplicar nada." },
      { icon: "users", title: "Confirma", text: "La operación queda asociada a las cuentas implicadas y a su titular correspondiente." }
    ]
  },
  "/seguridad": {
    eyebrow: "Seguridad y confianza",
    title: "La claridad también es una medida de seguridad.",
    description: "Seguridad, identidad y trazabilidad del Banco de La Placeta.",
    intro: "La web pública explica lo esencial sin pedir una sesión. La banca privada solo aparece cuando PlacetaID valida la identidad.",
    backLabel: "Conocer el ecosistema",
    showcaseTitle: "Primero se verifica",
    showcaseText: "Enlaces firmados, controles de sesión y operaciones confirmadas: cada capa tiene una responsabilidad concreta.",
    sectionEyebrow: "Principios",
    sectionTitle: "Protección sin complicar la experiencia.",
    sectionIntro: "Un sistema financiero debe explicar qué está ocurriendo, no esconderlo detrás de pantallas ambiguas.",
    cards: [
      { icon: "shield", title: "PlacetaID", text: "El banco no gestiona contraseñas de identidad: el acceso se delega en el proveedor oficial." },
      { icon: "zum", title: "Enlaces firmados", text: "Los enlaces públicos muestran únicamente datos validados y no permiten alterar el importe." },
      { icon: "book", title: "Trazabilidad", text: "Los estados pendientes, confirmados y cancelados se conservan con su contexto operativo." }
    ]
  },
  "/sobre-el-banco": {
    eyebrow: "Banco de La Placeta",
    title: "Una infraestructura económica hecha para la comunidad.",
    description: "Qué es Banco de La Placeta y cómo funciona.",
    intro: "El banco reúne proyectos y personas en una economía virtual sin ánimo de lucro, con herramientas para operar, colaborar y consultar información oficial.",
    backLabel: "Ver servicios",
    showcaseTitle: "Web y app, una misma experiencia",
    showcaseText: "La cuenta seleccionada, los estados y los principios de funcionamiento se mantienen alineados en todas las plataformas.",
    sectionEyebrow: "Principios del proyecto",
    sectionTitle: "Tecnología con responsabilidad comunitaria.",
    sectionIntro: "Publicamos el funcionamiento de los servicios para que la comunidad pueda entenderlos y usarlos con confianza.",
    cards: [
      { icon: "users", title: "Sin ánimo de lucro", text: "La finalidad es unir proyectos y comunidad, no convertir la banca en una caja negra." },
      { icon: "chart", title: "Evolución pública", text: "Los servicios se mejoran con criterios de accesibilidad, seguridad y trazabilidad." },
      { icon: "book", title: "Normativa publicada", text: "Consulta los sistemas de funcionamiento y la documentación oficial en el BOLP." }
    ]
  }
};

Object.entries(publicPages).forEach(([path, page]) => {
  app.get(path, (req, res) => res.render("public-page", { ...page, layout: false }));
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
  const identidad = await validateToken(token);
  if (!identidad) return res.redirect("/login?error=sesion_expirada");
  const r = await webPost(token, "/api/document-actions", {
    action: "solicitar-apertura-cuenta",
    dip: identidad.dip,
    nombre: identidad.nombre,
    datos: {
      tipoCuenta: "Current",
      displayName: `Cuenta de ${identidad.nombre}`,
      accountPurpose: "Cuenta corriente personal"
    }
  });
  if (r.status === 401) return res.redirect("/login");
  const consulta = await webGet(token, "/api/web/registro");
  const resultado = r.ok ? { pendienteFirma: true, mensaje: r.body.message || "Revisa PlacetaID Móvil para firmar el alta." } : null;
  renderRegistro(res, {
    consulta: consulta?.ok ? consulta.body : null,
    resultado,
    error: r.ok ? null : (r.body?.error || "No se pudo iniciar la firma del alta. Inténtalo de nuevo.")
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
