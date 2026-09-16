import PDFDocument from "pdfkit";

// Genera un justificante en PDF de una declaración tributaria (IRM/IGF).
export function generarJustificanteDeclaracion(res, { nombre, dip, decl }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="declaracion-${decl.mes_periodo || "tributos"}.pdf"`
  );
  doc.pipe(res);

  doc.fontSize(20).fillColor("#4D00FF").text("Banco de La Placeta");
  doc.fontSize(12).fillColor("#333333").text("Justificante de declaración tributaria");
  doc.moveDown();

  doc.fontSize(10).fillColor("#555555");
  doc.text(`Titular: ${nombre}`);
  doc.text(`DIP: ${dip}`);
  doc.moveDown();

  doc.fontSize(11).fillColor("#111111");
  doc.text(`Periodo: ${decl.mes_periodo || "—"}`);
  doc.text(`Patrimonio medio: ${Number(decl.patrimonio_medio || 0).toLocaleString("es-ES")} Pz`);
  doc.text(`Índice de acumulación: ${Number(decl.indice_acumulacion || 0).toLocaleString("es-ES")} %`);
  doc.text(`Cuota IRM: ${Number(decl.cuota_irm || 0).toLocaleString("es-ES")} Pz`);
  doc.text(`Cuota IGF: ${Number(decl.cuota_igf || 0).toLocaleString("es-ES")} Pz`);
  doc.text(`Estado: ${decl.estado_pago || "—"}`);
  doc.moveDown();

  doc.fontSize(9).fillColor("#888888");
  doc.text(
    `Emitido el ${new Date().toLocaleDateString("es-ES")} · Documento informativo del ecosistema de La Placeta (sin valor de curso legal).`
  );

  doc.end();
}

// Genera el comprobante descargable de una transferencia ya registrada.
export function generarComprobanteNomina(res, { periodo, contrato, empresa, trabajador }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const safeId = String(periodo.id || "nomina").replace(/[^a-zA-Z0-9_-]/g, "-");
  const bruto = Number(periodo.brutoPz ?? contrato.grossSalaryPz ?? 0);
  const retencion = Number(periodo.retencionesPz ?? periodo.workerTaxPz ?? 0);
  const neto = Number(periodo.netoPz ?? periodo.netSalaryPz ?? Math.max(0, bruto - retencion));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="nomina-${safeId}.pdf"`);
  doc.pipe(res);
  doc.fontSize(20).fillColor("#4D00FF").text("Banco de La Placeta");
  doc.fontSize(12).fillColor("#333333").text("Recibo de nómina");
  doc.moveDown();
  doc.fontSize(10).fillColor("#555555");
  doc.text(`Empresa: ${empresa?.displayName || contrato.companyAccountId || "—"}`);
  doc.text(`EIP: ${empresa?.eip || "—"}`);
  doc.text(`Cuenta pagadora: ${contrato.companyAccountId || "—"}`);
  doc.moveDown();
  doc.fontSize(11).fillColor("#111111");
  doc.text(`Trabajador: ${contrato.employeeName || trabajador?.displayName || "—"}`);
  doc.text(`DIP: ${contrato.employeeDip || "—"}`);
  doc.text(`Cuenta abonada: ${trabajador?.id || contrato.employeeAccountId || "—"}`);
  doc.text(`IBAN: ${trabajador?.iban || "—"}`);
  doc.text(`Puesto: ${contrato.roleTitle || "Trabajador"}`);
  doc.text(`Frecuencia: ${contrato.frequency || "—"}`);
  doc.moveDown();
  doc.text(`Periodo: ${periodo.periodo || periodo.label || periodo.id || "—"}`);
  doc.text(`Estado: ${periodo.status || "Pending"}`);
  doc.text(`Salario bruto: ${bruto.toLocaleString("es-ES")} Pz`);
  doc.text(`Retención trabajador: ${retencion.toLocaleString("es-ES")} Pz`);
  doc.text(`Salario neto abonado: ${neto.toLocaleString("es-ES")} Pz`);
  doc.moveDown();
  doc.fontSize(9).fillColor("#888888").text("Documento informativo emitido por el Banco de La Placeta. Conserva este recibo junto con la referencia del periodo.");
  doc.end();
}

export function generarComprobanteTransferencia(res, { nombre, dip, movimiento }) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const safeId = String(movimiento.id || "transferencia").replace(/[^a-zA-Z0-9_-]/g, "-");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="comprobante-${safeId}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).fillColor("#4D00FF").text("Banco de La Placeta");
  doc.fontSize(12).fillColor("#333333").text("Comprobante de transferencia");
  doc.moveDown();
  doc.fontSize(10).fillColor("#555555");
  doc.text(`Titular: ${nombre || "—"}`);
  doc.text(`DIP: ${dip || "—"}`);
  doc.moveDown();
  doc.fontSize(11).fillColor("#111111");
  doc.text(`Referencia: ${movimiento.id || "—"}`);
  doc.text(`Fecha: ${movimiento.createdAt ? new Date(movimiento.createdAt).toLocaleString("es-ES") : "—"}`);
  doc.text(`Concepto: ${movimiento.concept || "—"}`);
  doc.text(`Cuenta origen: ${movimiento.fromAccountId || "—"}`);
  doc.text(`Cuenta destino: ${movimiento.toAccountId || "—"}`);
  doc.text(`Importe: ${Number(movimiento.amountPz || 0).toLocaleString("es-ES")} Pz`);
  doc.text(`Estado: ${movimiento.status || "—"}`);
  doc.moveDown();
  doc.fontSize(9).fillColor("#888888").text(
    "Documento informativo emitido por el Banco de La Placeta. Conserva la referencia para cualquier consulta."
  );
  doc.end();
}
