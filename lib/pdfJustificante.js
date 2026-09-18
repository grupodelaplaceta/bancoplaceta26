import PDFDocument from "pdfkit";
import fs from "fs";
import { fileURLToPath } from "url";

const BRAND = "#3204D9";
const DARK = "#150259";
const MUTED = "#4F4A73";
const LIGHT = "#F2ECFF";
const BORDER = "#DDDDF4";
const ICON_PATH = fileURLToPath(new URL("../public/brand/icon.png", import.meta.url));

function iniciarDocumento(res, filename, title, subtitle) {
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.roundedRect(42, 36, 511, 88, 14).fill(LIGHT);
  if (fs.existsSync(ICON_PATH)) doc.image(ICON_PATH, 58, 52, { fit: [52, 52] });
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(16).text("BANCO DE", 125, 55);
  doc.fillColor(BRAND).fontSize(20).text("La Placeta", 125, 75);
  doc.fillColor(DARK).fontSize(14).text(title, 330, 55, { width: 205, align: "right" });
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(subtitle, 330, 78, { width: 205, align: "right" });
  doc.moveTo(50, 143).lineTo(545, 143).lineWidth(1.5).strokeColor(BRAND).stroke();
  return doc;
}

function section(doc, title) {
  doc.moveDown(0.8);
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(11).text(title);
  doc.moveDown(0.25);
}

function field(doc, label, value) {
  doc.fillColor(MUTED).font("Helvetica").fontSize(8.5).text(label);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(String(value ?? "—"));
  doc.moveDown(0.25);
}

function dinero(value) {
  return `${Number(value || 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Pz`;
}

function etiquetaCuenta(value, fallback = "Cuenta") {
  if (!value) return fallback;
  const text = String(value).trim();
  if (/^acc[-_]/i.test(text) || /^cuenta[-_]/i.test(text) || /^id[-_]/i.test(text)) return fallback;
  return text;
}

function legalFooter(doc, extra = "") {
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    doc.moveTo(50, 770).lineTo(545, 770).lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.fillColor(MUTED).font("Helvetica").fontSize(7.5).text(
      `Uso en el ecosistema La Placeta. Documento informativo de uso interno; no constituye dinero de curso legal ni sustituye una factura, contrato o justificante oficial. ${extra}`,
      50, 780, { width: 495, align: "left" }
    );
    doc.text(`Emitido el ${new Date().toLocaleString("es-ES")} · Banco de La Placeta`, 50, 802, { width: 495, align: "right" });
  }
}

// Justificante de declaración tributaria con la identidad visual común.
export function generarJustificanteDeclaracion(res, { nombre, dip, decl }) {
  const doc = iniciarDocumento(res, `declaracion-${decl.mes_periodo || "tributos"}.pdf`, "Declaración tributaria", "IRM / IGF");
  section(doc, "Titular");
  field(doc, "Titular", nombre);
  field(doc, "DIP", dip);
  section(doc, "Detalle fiscal");
  field(doc, "Periodo", decl.mes_periodo || "—");
  field(doc, "Patrimonio medio", `${Number(decl.patrimonio_medio || 0).toLocaleString("es-ES")} Pz`);
  field(doc, "Índice de acumulación", `${Number(decl.indice_acumulacion || 0).toLocaleString("es-ES")} %`);
  field(doc, "Cuota IRM", `${Number(decl.cuota_irm || 0).toLocaleString("es-ES")} Pz`);
  field(doc, "Cuota IGF", `${Number(decl.cuota_igf || 0).toLocaleString("es-ES")} Pz`);
  field(doc, "Estado", decl.estado_pago || "—");
  legalFooter(doc, "Las obligaciones fiscales se rigen por la normativa aplicable del ecosistema.");
  doc.end();
}

// Recibo de nómina con detalle de empresa, EIP, cuentas y complementos.
export function generarComprobanteNomina(res, { periodo, contrato, empresa, trabajador }) {
  const doc = iniciarDocumento(res, `nomina-${String(periodo?.periodo || "nomina").replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`, "Nómina", "Detalle del pago");
  const bruto = Number(periodo?.brutoPz ?? contrato?.grossSalaryPz ?? 0);
  const retencion = Number(periodo?.retencionesPz ?? periodo?.workerTaxPz ?? 0);
  const neto = Number(periodo?.netoPz ?? periodo?.netSalaryPz ?? Math.max(0, bruto - retencion));
  const estado = String(periodo?.status || "Pending").toLowerCase() === "pending" ? "Pendiente" : "Pagado";
  const complementos = Array.isArray(contrato?.complementos) ? contrato.complementos : [];
  const empresaNombre = String(empresa?.displayName || contrato?.companyAccountId || "Empresa").trim();
  const trabajadorNombre = String(contrato?.employeeName || trabajador?.displayName || "Trabajador").trim();
  const accountLabel = etiquetaCuenta(contrato?.companyAccountId, "Cuenta de la empresa");

  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(16).text("Resumen del periodo", 52, 165);
  doc.fillColor(estado === "Pendiente" ? "#D97706" : "#059669").font("Helvetica-Bold").fontSize(12).text(estado, 420, 165, { align: "right" });

  const summaryBoxY = 190;
  doc.roundedRect(50, summaryBoxY, 240, 58, 12).fill(LIGHT);
  doc.roundedRect(300, summaryBoxY, 210, 58, 12).fill(LIGHT);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Bruto", 65, summaryBoxY + 12);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(18).text(dinero(bruto), 65, summaryBoxY + 24);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Neto", 315, summaryBoxY + 12);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(18).text(dinero(neto), 315, summaryBoxY + 24);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Periodo", 440, summaryBoxY + 12);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11).text(String(periodo?.periodo || periodo?.label || "Mes actual"), 440, summaryBoxY + 26, { width: 70, align: "left" });

  section(doc, "Empresa");
  field(doc, "Entidad", empresaNombre);
  field(doc, "EIP", empresa?.eip || "No disponible");
  field(doc, "Cuenta de pago", accountLabel);

  section(doc, "Trabajador");
  field(doc, "Nombre", trabajadorNombre);
  field(doc, "DIP", contrato?.employeeDip || "No disponible");
  field(doc, "Cuenta de abono", etiquetaCuenta(trabajador?.id || contrato?.employeeAccountId, "Cuenta del trabajador"));
  field(doc, "IBAN", trabajador?.iban || "No disponible");
  field(doc, "Cargo y frecuencia", `${contrato?.roleTitle || "Trabajador"} · ${contrato?.frequency || "Mensual"}`);

  section(doc, "Liquidación");
  doc.roundedRect(50, doc.y + 8, 470, 90, 12).fillOpacity(0.04).fillAndStroke(LIGHT, BORDER);
  doc.fillOpacity(1);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text("Base", 65, doc.y + 18);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(dinero(bruto), 180, doc.y + 18);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text("Retención", 65, doc.y + 38);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(dinero(retencion), 180, doc.y + 38);
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(10).text("Neto abonado", 65, doc.y + 58);
  doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(10).text(dinero(neto), 180, doc.y + 58);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`Estado: ${estado}`, 355, doc.y + 20);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`Fecha: ${new Date(periodo?.updatedAt || Date.now()).toLocaleDateString("es-ES")}`, 355, doc.y + 38);
  doc.moveDown(3.5);

  if (complementos.length) {
    section(doc, "Complementos del contrato");
    complementos.forEach((item) => field(doc, item.concepto || "Complemento", `${dinero(item.importePz || 0)} · ${item.tipo === "actividad" ? "Actividad" : "Cargo fijo"}`));
  }

  legalFooter(doc, "Este documento refleja la nómina registrada en el Banco de La Placeta y se usa como comprobante informativo para la persona trabajadora y la empresa.");
  doc.end();
}

// Comprobante de transferencia con el mismo encabezado y pie legal.
export function generarComprobanteTransferencia(res, { nombre, dip, movimiento }) {
  const doc = iniciarDocumento(res, `comprobante-${String(movimiento?.id || "transferencia").replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`, "Transferencia", "Comprobante del movimiento");
  const importe = Number(movimiento?.amountPz || 0);
  const concepto = String(movimiento?.concept || "Movimiento bancario").trim();
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(16).text("Detalle del movimiento", 52, 165);
  doc.roundedRect(50, 190, 470, 58, 12).fill(LIGHT);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Importe", 65, 205);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(20).text(dinero(importe), 65, 218);
  doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("Estado", 360, 205);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11).text(String(movimiento?.status || "Confirmado"), 360, 218);

  section(doc, "Titular");
  field(doc, "Titular", nombre || "Persona" );
  field(doc, "DIP", dip || "No disponible");
  section(doc, "Movimiento");
  field(doc, "Concepto", concepto || "Movimiento bancario");
  field(doc, "Fecha", movimiento?.createdAt ? new Date(movimiento.createdAt).toLocaleString("es-ES") : "No disponible");
  field(doc, "Cuenta de origen", etiquetaCuenta(movimiento?.fromAccountId, "Cuenta origen"));
  field(doc, "Cuenta de destino", etiquetaCuenta(movimiento?.toAccountId, "Cuenta destino"));
  field(doc, "IVA", dinero(movimiento?.ivaPz || 0));
  legalFooter(doc, "Este comprobante sirve como justificante del movimiento realizado en Banco de La Placeta");
  doc.end();
}
