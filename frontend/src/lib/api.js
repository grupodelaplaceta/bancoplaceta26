const pendingGet = new Map();

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    const error = new Error("no_autenticado");
    error.body = payload;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `Error ${response.status}`);
    error.body = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function query(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  });
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

function get(path) {
  if (pendingGet.has(path)) return pendingGet.get(path);
  const operation = request(path).finally(() => pendingGet.delete(path));
  pendingGet.set(path, operation);
  return operation;
}

function post(path, body, idempotencyKey) {
  return request(path, {
    method: "POST",
    body,
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
  });
}

export const api = {
  me: () => get("/bff/me"),
  seleccionarCuenta: (cuenta) => post("/bff/cuenta/seleccionar", { cuenta }),
  solicitarApertura: (body) => post("/bff/apertura", body),
  solicitarProducto: (body) => post("/bff/productos/solicitar", body),
  productos: (cuenta) => get(`/bff/productos${query({ cuenta })}`),
  ventas: (cuenta) => get(`/bff/ventas${query({ cuenta })}`),
  movimientos: (cuenta, limit = 50) => get(`/bff/movimientos${query({ cuenta, limit })}`),
  tarjetas: (cuenta) => get(`/bff/tarjetas${query({ cuenta })}`),
  gestores: (cuenta) => get(`/bff/gestores${query({ cuenta })}`),
  crearGestor: (body) => post("/bff/gestores", body),
  añadirCotitular: (body) => post("/bff/gestores", body),
  inversiones: (cuenta) => get(`/bff/inversiones${query({ cuenta })}`),
  iniciarInversion: (body) => post("/bff/inversiones", body),
  liquidarInversion: (id) => post(`/bff/inversiones/${encodeURIComponent(id)}/liquidar`, {}),
  nominas: (cuenta) => get(`/bff/nominas${query({ cuenta })}`),
  buscarTrabajador: (dip) => get(`/bff/nominas/trabajadores/buscar${query({ dip })}`),
  altaTrabajador: (body) => post("/bff/nominas/trabajadores", body),
  despedirTrabajador: (id) => post(`/bff/nominas/trabajadores/${encodeURIComponent(id)}/despedir`, {}),
  contactos: (cuenta) => get(`/bff/contactos${query({ cuenta })}`),
  tributos: (cuenta) => get(`/bff/tributos${query({ cuenta })}`),
  facturacion: (cuenta, mes) => get(`/bff/facturacion${query({ cuenta, mes })}`),
  facturacionPagar: (body) => post("/bff/facturacion/pagar-iva", body),
  subvenciones: (cuenta) => get(`/bff/subvenciones${query({ cuenta })}`),
  cumplimiento: (cuenta) => get(`/bff/cumplimiento${query({ cuenta })}`),
  transferir: (body, key) => post("/bff/transferencia", body, key),
  placezumCodigo: (cuenta) => post("/bff/placezum/codigo", { cuenta }),
  placezumPagar: (body, key) => post("/bff/placezum/pagar", body, key),
};

export function formatPz(value) {
  const amount = Number(value);
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatFecha(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
