import { useState } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";

const ACCOUNT_OPTIONS = [
  {
    id: "current-web",
    kind: "account",
    title: "Cuenta Corriente Web",
    summary: "Cuenta de uso diario para operaciones y gestión financiera desde la web del banco.",
    detail: "Ideal para ingresos, gastos, transferencias y el cobro de nóminas o pagos habituales desde el portal público del cliente.",
    icon: "wallet",
    action: "Solicitar Cuenta Corriente Web",
    accountType: "Current",
    platform: "web",
    characteristics: ["Uso diario en la web", "Pagos y cobros en la cuenta principal", "Tarjeta vinculada opcional"],
  },
  {
    id: "current-app",
    kind: "account",
    title: "Cuenta Corriente APP",
    summary: "Cuenta corriente asociada a la experiencia móvil del banco y su plataforma de la app.",
    detail: "Se gestiona y firma con la misma identidad del titular, pero su IBAN está diferenciado por la plataforma usada en la app.",
    icon: "wallet",
    action: "Solicitar Cuenta Corriente APP",
    accountType: "Current",
    platform: "app",
    characteristics: ["IBAN diferenciado por plataforma", "Compatible con la app", "Firma y gestión desde PlacetaID Móvil"],
  },
  {
    id: "savings-web",
    kind: "account",
    title: "Cuenta Ahorro Web",
    summary: "Cuenta de ahorro con interés directo diario del 0,02 % desde Banco de La Placeta.",
    detail: "Se mantiene diferenciada por plataforma y mantiene un IBAN propio para el canal web y su gestión de ahorro.",
    icon: "chart",
    action: "Solicitar Cuenta Ahorro Web",
    accountType: "Savings",
    platform: "web",
    characteristics: ["0,02 % de interés directo diario", "IBAN diferenciado por plataforma", "Ahorro con seguimiento y tramos claros"],
  },
  {
    id: "savings-app",
    kind: "account",
    title: "Cuenta Ahorro APP",
    summary: "Cuenta de ahorro para la plataforma móvil con el mismo interés directo del 0,02 % diario.",
    detail: "Se asocia a la app con su IBAN propio, evitando mezclas entre la plataforma web y la mobile del banco.",
    icon: "chart",
    action: "Solicitar Cuenta Ahorro APP",
    accountType: "Savings",
    platform: "app",
    characteristics: ["0,02 % de interés directo diario", "IBAN con plataforma distinta", "Gestión y vista desde la app"],
  },
  {
    id: "Business",
    kind: "account",
    title: "Cuenta de empresa",
    summary: "Empresas y organismos con EIP verificado y proyecto fiscalizado.",
    detail: "Permite operar con una entidad validada, gestionar facturación y activar ayudas si corresponde.",
    icon: "building",
    action: "Solicitar cuenta de empresa",
    accountType: "Business",
    platform: "web",
    characteristics: ["EIP verificado requerido", "Facturación y pagos corporativos", "Promoción posible con justificación RSP"],
  },
];

const CARD_OPTIONS = [
  {
    id: "placetapay-debito",
    kind: "card",
    title: "Tarjeta PlacetaPay Débito",
    summary: "Pago directo con saldo disponible de la cuenta activa.",
    detail: "Tarjeta digital y de uso habitual con control de límites, gasto y seguridad desde el banco.",
    icon: "card",
    action: "Solicitar tarjeta",
    image: "/img/tarjta-debito-26.jpg",
    characteristics: ["Uso directo desde el saldo", "Límites de contactless y semanal", "Control desde el panel del cliente"],
  },
  {
    id: "promo-physical",
    kind: "card",
    title: "Tarjeta física promocional",
    summary: "Versión con imagen promocional del banco para uso personal o presentación.",
    detail: "Diseño compatible con la imagen ya usada en la app para ofrecer la tarjeta con identidad visual del banco.",
    icon: "card",
    action: "Solicitar tarjeta física",
    image: "/img/tarjta-debito-26.jpg",
    characteristics: ["Diseño visual del banco", "Útil para pagos físicos y gestión", "Emisión e identidad corporativa"],
  },
];

const ALL_OPTIONS = [...ACCOUNT_OPTIONS, ...CARD_OPTIONS];

export default function ProductLauncher({ cuenta }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [virtualName, setVirtualName] = useState("Curso de onboarding corporativo");
  const [virtualPrice, setVirtualPrice] = useState("199");
  const [virtualSlug, setVirtualSlug] = useState("curso-onboarding-corporativo");
  const isCompany = ["business", "empresa", "organismo", "state"].includes(String(cuenta?.type || "").toLowerCase());

  const quickActions = [
    { id: isCompany ? "productos" : "alta-producto", label: isCompany ? "Gestionar productos" : "Alta producto", icon: isCompany ? "chip" : "plus", action: () => { setExpanded(false); if (isCompany) { window.location.hash = "productos"; return; } setSelected(ACCOUNT_OPTIONS[0]); setOpen(true); setFeedback(null); } },
    { id: isCompany ? "ventas" : "nueva-factura", label: isCompany ? "Ventas" : "Nueva factura", icon: "receipt", action: () => { setExpanded(false); if (isCompany) { window.location.hash = "ventas"; return; } window.location.hash = "facturacion"; } },
    { id: "producto-virtual", label: "Crear un producto virtual", icon: "chip", action: () => { setExpanded(false); setSelected({ ...ACCOUNT_OPTIONS[0], title: "Producto virtual", summary: "Vende tu producto desde una URL o pasarela insertable.", detail: "Empresas y proyectos pueden crear productos virtuales, compartir una URL de venta y recibir la confirmación del pago desde la web.", action: "Preparar producto virtual", characteristics: ["URL de venta", "Pasarela insertable", "Respuesta del pago"], kind: "virtual" }); setOpen(true); setFeedback(null); } },
    { id: "gestores", label: "Gestores", icon: "users", action: () => { setExpanded(false); window.location.hash = "gestores"; } },
    { id: "transferir", label: "Transferir (PlaceZum o transferencia)", icon: "send", action: () => { setExpanded(false); window.location.hash = "transferencia"; } },
  ];

  const buildVirtualProduct = () => {
    const safeName = String(virtualName || "Producto virtual").trim() || "Producto virtual";
    const safePrice = Number(virtualPrice) || 0;
    const slug = String(virtualSlug || safeName).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "producto-virtual";
    const publicUrl = `${window.location.origin}/pagar/${encodeURIComponent(slug)}?source=empresa`;
    const embedCode = `<iframe src="${publicUrl}" title="${safeName}" style="width:100%; min-height:720px; border:none; border-radius:16px;"></iframe>`;
    return { safeName, safePrice, slug, publicUrl, embedCode };
  };

  async function solicitar() {
    if (!selected || !cuenta) return;
    setWorking(true);
    setFeedback(null);

    try {
      if (selected.kind === "account") {
        const result = await api.solicitarApertura({
          tipoCuenta: selected.accountType,
          platform: selected.platform || "web",
          displayName: selected.title,
          eip: "",
          accountPurpose: "Solicitado desde el botón + del panel del cliente.",
        });
        setFeedback({ type: "success", text: result.message || "Solicitud enviada. Revisa PlacetaID Móvil para firmar." });
        return;
      }

      if (selected.kind === "virtual") {
        const product = buildVirtualProduct();
        setFeedback({
          type: "success",
          text: `Producto creado: ${product.safeName} (${product.safePrice} Pz). URL pública: ${product.publicUrl}`
        });
        return;
      }

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
      <div className={`product-launcher-cluster ${expanded ? "is-expanded" : ""}`} aria-live="polite">
        {quickActions.map((action, index) => (
          <button
            key={action.id}
            type="button"
            className="product-launcher-action"
            style={{
              transform: `translate(${Math.cos((index / quickActions.length) * Math.PI * 2 - Math.PI / 2) * 76}px, ${Math.sin((index / quickActions.length) * Math.PI * 2 - Math.PI / 2) * 76}px)`,
              opacity: expanded ? 1 : 0,
            }}
            onClick={action.action}
          >
            <span className="product-launcher-action-icon"><Icon name={action.icon} size={18} /></span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      <button type="button" className="product-launcher" aria-label="Dar de alta un producto" onClick={() => { setExpanded((value) => !value); setOpen(false); setFeedback(null); }}>
        <Icon name="plus" size={24} />
      </button>
      {open && (
        <div className="product-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
            <div className="product-modal-header">
              <div>
                <p className="eyebrow">Banco de La Placeta</p>
                <h2 id="product-modal-title">Nuevo producto</h2>
                <p>Elige una cuenta o una tarjeta y revisa sus características antes de firmar.</p>
              </div>
              <button type="button" className="product-close" aria-label="Cerrar" onClick={() => setOpen(false)}><Icon name="close" size={20} /></button>
            </div>

            {!selected ? (
              <div className="product-layout">
                <div className="product-section">
                  <div className="product-section-header"><span className="product-section-label">Cuentas</span></div>
                  <div className="product-grid product-grid-accounts">
                    {ACCOUNT_OPTIONS.map((product) => (
                      <button type="button" className="product-option" key={product.id} onClick={() => setSelected(product)}>
                        <span className="product-option-icon"><Icon name={product.icon} size={22} /></span>
                        <strong>{product.title}</strong>
                        <span>{product.summary}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="product-section">
                  <div className="product-section-header"><span className="product-section-label">Tarjetas</span></div>
                  <div className="product-grid product-grid-cards">
                    {CARD_OPTIONS.map((product) => (
                      <button type="button" className="product-option product-option-card" key={product.id} onClick={() => setSelected(product)}>
                        <span className="product-option-visual">
                          <img src={product.image} alt={product.title} />
                        </span>
                        <strong>{product.title}</strong>
                        <span>{product.summary}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="product-detail">
                <button type="button" className="product-back" onClick={() => { setSelected(null); setFeedback(null); }}>← Ver opciones</button>

                {selected.image && (
                  <div className="product-card-visual">
                    <img src={selected.image} alt={selected.title} />
                  </div>
                )}

                <div className="product-detail-icon"><Icon name={selected.icon} size={30} /></div>
                <h3>{selected.title}</h3>
                <p>{selected.detail}</p>

                {selected.kind === "virtual" ? (
                  <div className="product-virtual-form">
                    <label>
                      <span>Nombre del producto</span>
                      <input value={virtualName} onChange={(event) => setVirtualName(event.target.value)} />
                    </label>
                    <label>
                      <span>Precio (Pz)</span>
                      <input type="number" min="1" value={virtualPrice} onChange={(event) => setVirtualPrice(event.target.value)} />
                    </label>
                    <label>
                      <span>Slug de la URL</span>
                      <input value={virtualSlug} onChange={(event) => setVirtualSlug(event.target.value)} />
                    </label>
                    <div className="product-virtual-preview">
                      <strong>URL pública</strong>
                      <code>{buildVirtualProduct().publicUrl}</code>
                    </div>
                    <div className="product-virtual-preview">
                      <strong>Pasarela insertable</strong>
                      <code>{buildVirtualProduct().embedCode}</code>
                    </div>
                  </div>
                ) : (
                  <div className="product-characteristics">
                    {selected.characteristics.map((item) => (
                      <span key={item} className="product-characteristic">{item}</span>
                    ))}
                  </div>
                )}

                <dl>
                  <div><dt>Cuenta</dt><dd>{cuenta?.displayName || cuenta?.id || "Cuenta activa"}</dd></div>
                  <div><dt>Solicitante</dt><dd>{selected.kind === "account" ? "Titular del banco" : "Persona titular"}</dd></div>
                  <div><dt>Autorización</dt><dd>Firma electrónica en PlacetaID Móvil</dd></div>
                  <div><dt>Estado</dt><dd>Se activa después de la firma</dd></div>
                </dl>

                <button type="button" className="product-submit" disabled={working} onClick={solicitar}>{working ? "Enviando…" : selected.action}</button>
                {feedback && <div className={`product-feedback product-feedback-${feedback.type}`}>{feedback.text}</div>}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
