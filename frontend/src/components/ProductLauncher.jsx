import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";

const PRODUCTS = [
  {
    id: "placetapay-debito",
    title: "PlacetaPay Débito",
    summary: "Tarjeta de débito para pagar con el saldo de tu cuenta.",
    detail: "Emisión vinculada a la cuenta seleccionada, con control desde Banco de La Placeta.",
    icon: "card",
    action: "Solicitar tarjeta",
  },
  {
    id: "cuenta-ahorro",
    title: "Cuenta de ahorro",
    summary: "Separa tus objetivos sin mezclar el saldo operativo.",
    detail: "La apertura requiere revisar y firmar el contrato desde PlacetaID Móvil.",
    icon: "wallet",
    action: "Solicitar cuenta",
  },
  {
    id: "fondo-inversion",
    title: "Producto de inversión",
    summary: "Solicita acceso a productos de inversión disponibles.",
    detail: "La contratación queda pendiente hasta que aceptes las condiciones en PlacetaID Móvil.",
    icon: "chart",
    action: "Solicitar producto",
  },
];

export default function ProductLauncher({ cuenta }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function solicitar() {
    if (!selected || !cuenta) return;
    setWorking(true);
    setFeedback(null);
    try {
      const result = await api.solicitarProducto({ productType: selected.id, accountId: cuenta.id });
      setFeedback({ type: "success", text: result.message || "Solicitud enviada. Firma el contrato desde PlacetaID Móvil." });
    } catch (error) {
      setFeedback({ type: "error", text: error.body?.message || error.message || "No se pudo iniciar la solicitud." });
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <button type="button" className="product-launcher" aria-label="Dar de alta un producto" onClick={() => { setOpen(true); setFeedback(null); }}>
        <Icon name="plus" size={24} />
      </button>
      {open && (
        <div className="product-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
            <div className="product-modal-header">
              <div><p className="eyebrow">Banco de La Placeta</p><h2 id="product-modal-title">Nuevo producto</h2><p>Elige, revisa la información y firma en PlacetaID Móvil.</p></div>
              <button type="button" className="product-close" aria-label="Cerrar" onClick={() => setOpen(false)}><Icon name="close" size={20} /></button>
            </div>
            {!selected ? (
              <div className="product-grid">
                {PRODUCTS.map((product) => <button type="button" className="product-option" key={product.id} onClick={() => setSelected(product)}><span className="product-option-icon"><Icon name={product.icon} size={22} /></span><strong>{product.title}</strong><span>{product.summary}</span></button>)}
              </div>
            ) : (
              <div className="product-detail">
                <button type="button" className="product-back" onClick={() => { setSelected(null); setFeedback(null); }}>← Ver productos</button>
                <div className="product-detail-icon"><Icon name={selected.icon} size={30} /></div>
                <h3>{selected.title}</h3>
                <p>{selected.detail}</p>
                <dl><div><dt>Cuenta</dt><dd>{cuenta?.displayName || cuenta?.id}</dd></div><div><dt>Autorización</dt><dd>Firma electrónica en PlacetaID Móvil</dd></div><div><dt>Estado</dt><dd>Se activa después de la firma</dd></div></dl>
                <button type="button" className="product-submit" disabled={working} onClick={solicitar}>{working ? "Enviando a PlacetaID…" : selected.action}</button>
                {feedback && <div className={`product-feedback product-feedback-${feedback.type}`}>{feedback.text}</div>}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
