// Cliente del BFF del banco-web. El token PlacetaID viaja en una cookie
// httpOnly, así que estas llamadas son relativas al mismo origen y no
// exponen ninguna credencial en el navegador.

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  let body = {};
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (res.status === 401) {
    // Sesión caducada: vuelve al flujo de login de PlacetaID.
    window.location.href = "/login";
    throw new Error("no_autenticado");
  }
  if (res.status === 404 && body.error === "titular_no_encontrado") {
    // Identidad PlacetaID sin registro bancario: alta.
    window.location.href = "/registro";
    throw new Error("no_registrado");
  }
  if (!res.ok) {
    const err = new Error(body.error || `http_${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export const api = {
  me: () => request("/bff/me"),
  cuenta: () => request("/bff/me"),
  movimientos: (cuenta, limit = 100) =>
    request(`/bff/movimientos?cuenta=${encodeURIComponent(cuenta || "")}&limit=${limit}`),
  tarjetas: (cuenta) => request(`/bff/tarjetas?cuenta=${encodeURIComponent(cuenta || "")}`),
  gestores: () => request("/bff/gestores"),
  inversiones: () => request("/bff/inversiones"),
  nominas: () => request("/bff/nominas"),
  tributos: () => request("/bff/tributos"),
  facturacion: () => request("/bff/facturacion"),
  subvenciones: () => request("/bff/subvenciones"),
  cumplimiento: () => request("/bff/cumplimiento"),
  contactos: () => request("/bff/contactos"),
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
