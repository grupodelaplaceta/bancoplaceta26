// BOLP — Boletín Oficial de La Placeta (valores CNIC en vivo, server-side).
// Lectura pública y sin claves. En servidor (sin navegador) no aplica el
// CORS restringido a laplaceta.org, así que esta web puede consultarlo.
const BOP_URL = (process.env.BOP_URL || "https://bop.laplaceta.org").replace(/\/+$/, "");

/**
 * Devuelve los valores NORMATIVOS del CNI-BANCO vigentes del BOLP.
 * Resuelve a { valores, revision, ok, error } — nunca lanza:
 *   valores: array de { codigo, resumen, unidad, tipo, articulo, bopUrl }
 *   (solo CNI-BANCO, los que aplican a cuentas del Banco de La Placeta).
 */
export async function cargarValoresBancarios() {
  try {
    const response = await fetch(`${BOP_URL}/api/valores?todo=1`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      return { valores: [], revision: null, ok: false, error: `El Boletín respondió ${response.status}.` };
    }
    const payload = await response.json();
    const valores = Object.keys(payload.valores || {})
      .map((codigo) => {
        const v = payload.valores[codigo];
        return {
          codigo: v.codigo || codigo,
          etiqueta: v.etiqueta || codigo,
          resumen: v.resumen || null,
          unidad: v.unidad || "",
          tipo: v.tipo || "numero",
          articulo: v.articulo || "",
          numero: typeof v.numero === "number" ? v.numero : null,
          bopUrl: `${BOP_URL}/cnic?codigo=${encodeURIComponent(v.codigo || codigo)}`
        };
      })
      .filter((v) => String(v.articulo || "").toUpperCase().startsWith("CNI-BANCO"));
    return { valores, revision: payload.revision || null, ok: true, error: null };
  } catch (e) {
    return { valores: [], revision: null, ok: false, error: "No se pudo conectar con el Boletín Oficial de La Placeta." };
  }
}
