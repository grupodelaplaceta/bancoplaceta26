// Sesión sin estado: el token PlacetaID viaja en una cookie httpOnly y corta.
const COOKIE_NAME = "bw_token";
// La cookie persiste para evitar cierres prematuros al cambiar de sección o
// volver días después. El acceso sigue dependiendo de la validez real del
// token PlacetaID; una cookie no convierte un token caducado en válido.
const TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export function getToken(req) {
  const cookieHeader = req.headers.cookie || "";
  const found = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!found) return null;
  try {
    return decodeURIComponent(found.slice(`${COOKIE_NAME}=`.length));
  } catch {
    return null;
  }
}

export function setTokenCookie(res, token) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", [
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${TOKEN_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`
  ]);
}

export function clearTokenCookie(res) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure ? "; Secure" : ""}`);
}

const CUENTA_COOKIE = "bw_cuenta";
const CUENTA_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export function getCuenta(req) {
  const cookieHeader = req.headers.cookie || "";
  const found = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${CUENTA_COOKIE}=`));
  if (!found) return null;
  try { return decodeURIComponent(found.slice(`${CUENTA_COOKIE}=`.length)); } catch { return null; }
}

export function setCuentaCookie(res, cuenta) {
  const secure = process.env.NODE_ENV === "production";
  res.setHeader("Set-Cookie", `${CUENTA_COOKIE}=${encodeURIComponent(cuenta)}; HttpOnly; Path=/; Max-Age=${CUENTA_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`);
}
