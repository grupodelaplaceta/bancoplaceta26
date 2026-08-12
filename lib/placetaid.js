// PlacetaID — integración de login y validación de tokens
const PLACETA_ID_BASE = (process.env.PLACETA_ID_BASE_URL || "https://id.laplaceta.org").replace(/\/+$/, "");
const SESSION_URL = `${PLACETA_ID_BASE}/api/auth/session`;

export function loginUrl(callbackUrl) {
  return `${PLACETA_ID_BASE}/?from=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Valida el token contra el portal PlacetaID (endpoint de sesión).
 * Devuelve { registroId, dip, nombre, rol } o null si no es válido.
 */
export async function validateToken(token) {
  if (!token) return null;
  try {
    const response = await fetch(SESSION_URL, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    const registro = data?.registro;
    if (!data?.ok || !registro || !registro.dip) return null;
    return {
      dip: String(registro.dip).toUpperCase(),
      nombre: registro.nombreCompleto || `${registro.nombre || ""} ${registro.apellidos || ""}`.trim() || registro.dip,
      rol: registro.rol || "persona"
    };
  } catch {
    return null;
  }
}
