// Sesión sin estado: el token PlacetaID viaja en una cookie httpOnly y corta.
const COOKIE_NAME = "bw_token";
const TOKEN_MAX_AGE = 60 * 60; // 1h (misma vida que el token PlacetaID)

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
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}
