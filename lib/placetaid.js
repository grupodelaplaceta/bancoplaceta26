// PlacetaID — integración de login y validación de tokens
const PLACETA_ID_BASE = (process.env.PLACETA_ID_BASE_URL || "https://id.laplaceta.org").replace(/\/+$/, "");
const SESSION_URL = `${PLACETA_ID_BASE}/api/auth/session`;
// Solicitante web oficial del Banco de La Placeta. Se puede sustituir por el
// client_id que PlacetaID asigne al entorno de producción mediante ENV.
const CLIENT_ID = process.env.PLACETA_ID_CLIENT_ID || "79d7087aa027fac0250e832c4b5d39b2";

export function loginUrl(callbackUrl, state = "") {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: callbackUrl,
    platform: "web",
    from: callbackUrl
  });
  if (state) params.set("state", state);
  return `${PLACETA_ID_BASE}/?${params.toString()}`;
}

/**
 * Valida el token contra el portal PlacetaID (endpoint de sesión).
 * Devuelve { registroId, dip, nombre, rol } o null si no es válido.
 */
export async function validateToken(token) {
  if (!token) return false;
  try {
    const response = await fetch(SESSION_URL, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const registro = data?.registro;
    if (!data?.ok || !registro || !registro.dip) return false;
    return {
      dip: String(registro.dip).toUpperCase(),
      nombre: registro.nombreCompleto || `${registro.nombre || ""} ${registro.apellidos || ""}`.trim() || registro.dip,
      rol: registro.rol || "persona"
    };
  } catch {
    return null;
  }
}
