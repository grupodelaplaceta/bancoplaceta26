// Banco API — llamadas server-side a la API real (nunca exponer el token en el navegador)
const BANCO_API = (process.env.BANCO_API_URL || "https://api.banco.laplaceta.org").replace(/\/+$/, "");

async function request(token, method, path, body) {
  const headers = { authorization: `Bearer ${token}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BANCO_API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12000)
  });
  const text = await response.text();
  let parsed = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { parsed = { raw: text }; }
  return { ok: response.ok, status: response.status, body: parsed };
}

export function webGet(token, path) {
  return request(token, "GET", path);
}

export function webPost(token, path, body) {
  return request(token, "POST", path, body);
}
