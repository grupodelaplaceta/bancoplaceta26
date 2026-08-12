import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { loginUrl, validateToken } from "./lib/placetaid.js";
import { getToken, setTokenCookie, clearTokenCookie } from "./lib/session.js";
import { webGet, webPost } from "./lib/bancoApi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3003;
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const CALLBACK_URL = `${APP_URL}/auth/callback`;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "src/views"));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Cabeceras de seguridad + no-store (FASE 1.5)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});

// ── Autenticación ────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!getToken(req)) return res.redirect("/login");
  next();
}

app.get("/login", (req, res) => {
  if (getToken(req)) return res.redirect("/");
  res.render("login", { loginUrl: loginUrl(CALLBACK_URL), error: req.query.error || null });
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
  if (!r.ok) return res.status(502).render("error", { mensaje: "No se pudo conectar con el banco en este momento." });
  res.render("dashboard", { usuario: r.body.usuario, cuentas: r.body.cuentas, active: "inicio" });
});

app.get("/movimientos", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/movimientos?limit=200");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { mensaje: "No se pudieron cargar los movimientos." });
  res.render("movimientos", { movimientos: r.body.movimientos || [], active: "movimientos" });
});

app.get("/tarjetas", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/tarjetas");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { mensaje: "No se pudieron cargar las tarjetas." });
  res.render("tarjetas", { tarjetas: r.body.tarjetas || [], active: "tarjetas" });
});

app.get("/gestores", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/gestores");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { mensaje: "No se pudieron cargar los gestores." });
  res.render("gestores", { gestores: r.body.gestores || [], active: "gestores" });
});

app.get("/cumplimiento", requireAuth, async (req, res) => {
  const token = getToken(req);
  const r = await webGet(token, "/api/web/cumplimiento");
  if (r.status === 401) return res.redirect("/login");
  if (!r.ok) return res.status(502).render("error", { mensaje: "No se pudo cargar el cumplimiento." });
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
  if (!r.ok) return res.status(502).render("error", { mensaje: "No se pudo cargar tu información." });
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

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).render("error", { mensaje: "Página no encontrada." }));

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
