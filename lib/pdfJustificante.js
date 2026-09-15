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
