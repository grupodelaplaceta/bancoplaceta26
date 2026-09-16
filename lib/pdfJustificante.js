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
  doc.fillColor(MUTED).font("Helvetica").fontSize(9).text(label.toUpperCase());
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(String(value ?? "—"));
  doc.moveDown(0.25);
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
  const safeId = String(periodo.id || "nomina").replace(/[^a-zA-Z0-9_-]/g, "-");
  const doc = iniciarDocumento(res, `nomina-${safeId}.pdf`, "Recibo de nómina", "Detalle de pago");
  const bruto = Number(periodo.brutoPz ?? contrato.grossSalaryPz ?? 0);
  const retencion = Number(periodo.retencionesPz ?? periodo.workerTaxPz ?? 0);
  const neto = Number(periodo.netoPz ?? periodo.netSalaryPz ?? Math.max(0, bruto - retencion));
  section(doc, "Empresa pagadora");
  field(doc, "Empresa", empresa?.displayName || contrato.companyAccountId);
  field(doc, "EIP", empresa?.eip || "—");
  field(doc, "Cuenta que abona", contrato.companyAccountId);
  section(doc, "Trabajador");
  field(doc, "Nombre", contrato.employeeName || trabajador?.displayName);
  field(doc, "DIP", contrato.employeeDip);
  field(doc, "Cuenta abonada", trabajador?.id || contrato.employeeAccountId);
  field(doc, "IBAN", trabajador?.iban || "—");
  field(doc, "Puesto / frecuencia", `${contrato.roleTitle || "Trabajador"} · ${contrato.frequency || "—"}`);
  section(doc, "Liquidación");
  field(doc, "Periodo / estado", `${periodo.periodo || periodo.label || periodo.id} · ${periodo.status || "Pending"}`);
  field(doc, "Salario bruto", `${bruto.toLocaleString("es-ES")} Pz`);
  field(doc, "Retención trabajador", `${retencion.toLocaleString("es-ES")} Pz`);
  field(doc, "Salario neto abonado", `${neto.toLocaleString("es-ES")} Pz`);
  const complementos = Array.isArray(contrato.complementos) ? contrato.complementos : [];
  if (complementos.length) {
    section(doc, "Complementos del contrato");
    complementos.forEach((item) => field(doc, item.concepto || "Complemento", `${Number(item.importePz || 0).toLocaleString("es-ES")} Pz · ${item.tipo === "actividad" ? "actividad confirmable" : "cargo fijo"}`));
  }
  legalFooter(doc, "La nómina refleja los datos registrados por la empresa y el estado del periodo en el Banco de La Placeta.");
  doc.end();
}

// Comprobante de transferencia con el mismo encabezado y pie legal.
export function generarComprobanteTransferencia(res, { nombre, dip, movimiento }) {
  const safeId = String(movimiento.id || "transferencia").replace(/[^a-zA-Z0-9_-]/g, "-");
  const doc = iniciarDocumento(res, `comprobante-${safeId}.pdf`, "Comprobante de transferencia", "Movimiento bancario");
  section(doc, "Titular");
  field(doc, "Titular", nombre || "—");
  field(doc, "DIP", dip || "—");
  section(doc, "Detalle del movimiento");
  field(doc, "Referencia", movimiento.id);
  field(doc, "Fecha", movimiento.createdAt ? new Date(movimiento.createdAt).toLocaleString("es-ES") : "—");
  field(doc, "Concepto", movimiento.concept || "Movimiento bancario");
  field(doc, "Cuenta origen", movimiento.fromAccountId);
  field(doc, "Cuenta destino", movimiento.toAccountId);
  field(doc, "Importe", `${Number(movimiento.amountPz || 0).toLocaleString("es-ES")} Pz`);
  field(doc, "Estado", movimiento.status || "—");
  field(doc, "IVA", `${Number(movimiento.ivaPz || 0).toLocaleString("es-ES")} Pz`);
  legalFooter(doc, "Conserva la referencia para cualquier consulta dentro del ecosistema.");
  doc.end();
}
