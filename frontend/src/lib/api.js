// Cliente del BFF del banco-web. El token PlacetaID viaja en una cookie
// httpOnly, así que estas llamadas son relativas al mismo origen y no
// exponen ninguna credencial en el navegador.

const GET_CACHE = new Map();
const GET_INFLIGHT = new Map();
const GET_CACHE_MS = 8000;
const AUTH_REDIRECT_COOLDOWN_MS = 6000;
let lastAuthRedirectAt = 0;

function isDocumentContext() {
  const pathname = window.location.pathname || "/";
  const isPdfPath = /\/[^/]+\.pdf(?:$|[?#])|\.pdf(?:$|[?#])/i.test(pathname);
  const isPdfLikeRoute = /\/(comprobante|pdf|documento|descarga|download)(?:$|[/?#])/i.test(pathname);
  return isPdfPath || isPdfLikeRoute;
}

function triggerAuthRedirect() {
  const pathname = window.location.pathname || "/";
  if (pathname === "/login" || pathname === "/auth/callback") return;
  if (isDocumentContext()) return;
  const now = Date.now();
  if (now - lastAuthRedirectAt < AUTH_REDIRECT_COOLDOWN_MS) return;
  const target = `${pathname}${window.location.search}${window.location.hash}`;
  const key = "banco-auth-redirected";
  const lastTarget = window.sessionStorage.getItem(key);
  if (lastTarget === target) return;
  window.sessionStorage.setItem(key, target);
  lastAuthRedirectAt = now;
  window.location.replace(`/login?returnTo=${encodeURIComponent(target)}`);
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  if (method === "GET") {
    const cached = GET_CACHE.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (GET_INFLIGHT.has(path)) return GET_INFLIGHT.get(path);
    const pending = requestUncached(path, options).then((value) => {
      GET_CACHE.set(path, { value, expiresAt: Date.now() + GET_CACHE_MS });
      return value;
    }).finally(() => GET_INFLIGHT.delete(path));
    GET_INFLIGHT.set(path, pending);
    return pending;
  }
  GET_CACHE.clear();
  return requestUncached(path, options);
}

async function requestUncached(path, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  const { timeoutMs: _timeoutMs, signal: externalSignal, ...fetchOptions } = options;
  if (externalSignal) externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
  let res;
  try {
    res = await fetch(path, {
      ...fetchOptions,
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", ...(fetchOptions.body ? { "Content-Type": "application/json" } : {}), ...(fetchOptions.headers || {}) },
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("La conexión está tardando demasiado. Comprueba tu red e inténtalo de nuevo.");
    throw new Error("No se pudo conectar con Banco de La Placeta.");
  } finally {
    window.clearTimeout(timeout);
  }
  let body = {};
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (res.status === 401) {
    // Las 401 temporales pueden aparecer durante la revalidación del token o
    // al recuperar la sesión tras un refresh. No hacemos un bucle de redirect
    // continuo y solo redirigimos si no se ha hecho uno reciente.
    triggerAuthRedirect();
    throw new Error("no_autenticado");
  }
  if (res.status === 404 && body.error === "titular_no_encontrado") {
    // Identidad PlacetaID sin registro bancario: alta.
    window.location.href = "/registro";
    throw new Error("no_registrado");
  }
  if (!res.ok) {
    const message = res.status === 405
      ? "Esta operación no está disponible para este tipo de cuenta."
      : (body.error || `http_${res.status}`);
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  me: () => request("/bff/me"),
  cuenta: () => request("/bff/me"),
  solicitarApertura: (payload) => request("/bff/apertura", { method: "POST", body: JSON.stringify(payload) }),
  solicitarProducto: (payload) => request("/bff/productos/solicitar", { method: "POST", body: JSON.stringify(payload) }),
  productos: (cuenta) => request(`/bff/productos?cuenta=${encodeURIComponent(cuenta || "")}`),
  ventas: (cuenta) => request(`/bff/ventas?cuenta=${encodeURIComponent(cuenta || "")}`),
  movimientos: (cuenta, limit = 100) =>
    request(`/bff/movimientos?cuenta=${encodeURIComponent(cuenta || "")}&limit=${limit}`),
  tarjetas: (cuenta) => request(`/bff/tarjetas?cuenta=${encodeURIComponent(cuenta || "")}`),
  gestores: (cuenta) => request(`/bff/gestores?cuenta=${encodeURIComponent(cuenta || "")}`),
  añadirCotitular: (payload) => request("/bff/gestores", { method: "POST", body: JSON.stringify(payload) }),
  solicitarGestor: (payload) => request("/bff/gestores", { method: "POST", body: JSON.stringify(payload) }),
  inversiones: (cuenta) => request(`/bff/inversiones?cuenta=${encodeURIComponent(cuenta || "")}`),
  iniciarInversion: (payload) => request("/bff/inversiones", { method: "POST", body: JSON.stringify(payload) }),
  liquidarInversion: (id) => request(`/bff/inversiones/${encodeURIComponent(id)}/liquidar`, { method: "POST", body: "{}" }),
  nominas: (cuenta) => request(`/bff/nominas?cuenta=${encodeURIComponent(cuenta || "")}`),
  buscarTrabajador: (dip) => request(`/bff/nominas/trabajadores/buscar?dip=${encodeURIComponent(dip || "")}`),
  altaTrabajador: (payload) => request("/bff/nominas/trabajadores", { method: "POST", body: JSON.stringify(payload) }),
  despedirTrabajador: (id) => request(`/bff/nominas/trabajadores/${encodeURIComponent(id)}/despedir`, { method: "POST", body: "{}" }),
  contactos: (cuenta) => request(`/bff/contactos?cuenta=${encodeURIComponent(cuenta || "")}`),
  tributos: (cuenta) => request(`/bff/tributos?cuenta=${encodeURIComponent(cuenta || "")}`),
  facturacion: (cuenta, mes) => request(`/bff/facturacion?cuenta=${encodeURIComponent(cuenta || "")}${mes ? `&mes=${encodeURIComponent(mes)}` : ""}`),
  facturacionPagar: (payload) => request("/bff/facturacion/pagar-iva", { method: "POST", body: JSON.stringify(payload) }),
  subvenciones: (cuenta) => request(`/bff/subvenciones?cuenta=${encodeURIComponent(cuenta || "")}`),
  cumplimiento: (cuenta) => request(`/bff/cumplimiento?cuenta=${encodeURIComponent(cuenta || "")}`),
  contactos: (cuenta) => request(`/bff/contactos?cuenta=${encodeURIComponent(cuenta || "")}`),
  transferir: (payload) => request("/bff/transferencia", { method: "POST", body: JSON.stringify(payload) }),
  seleccionarCuenta: (cuenta) =>
    request("/bff/cuenta/seleccionar", { method: "POST", body: JSON.stringify({ cuenta }) }),
  placezumCodigo: (from) =>
    request("/bff/placezum/codigo", { method: "POST", body: JSON.stringify({ from }) }),
  placezumPagar: (payload) =>
    request("/bff/placezum/pagar", { method: "POST", body: JSON.stringify(payload) }),
};

export function formatPz(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(v);
}

export function formatFecha(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
