import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as path from 'path';
import { existsSync } from 'fs';
import { ExportDocument } from '../entities/export-document.entity';
import { Certification } from '../entities/certification.entity';

/**
 * Generates a PDF export certificate for a validated export document.
 * Follows the same PDFKit pattern as CertificationPdfService (US-047).
 * Intra-module join: ExportDocument + Certification share the certification schema.
 * US-068
 */
@Injectable()
export class ExportDocumentPdfService {
  private readonly logger = new Logger(ExportDocumentPdfService.name);
  private readonly fontsDir = path.join(process.cwd(), 'assets', 'fonts');

  constructor(
    @InjectRepository(ExportDocument)
    private readonly exportDocRepo: Repository<ExportDocument>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
  ) {}

  /**
   * Generate a PDF export certificate for an export document.
   * Returns a Buffer suitable for StreamableFile.
   */
  async generateExportCertificatePdf(exportDocId: string): Promise<Buffer> {
    const exportDoc = await this.exportDocRepo.findOne({ where: { id: exportDocId } });
    if (!exportDoc) {
      throw new NotFoundException({
        code: 'EXPORT_DOCUMENT_NOT_FOUND',
        message: `Export document ${exportDocId} not found`,
      });
    }

    const cert = await this.certRepo.findOne({ where: { id: exportDoc.certificationId } });

    this.logger.log({ exportDocId }, 'Generating export PDF certificate');
    return this.buildPdf(exportDoc, cert);
  }

  private buildPdf(exportDoc: ExportDocument, cert: Certification | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const dejavuPath = path.join(this.fontsDir, 'DejaVuSans.ttf');
      const hasDejaVu = existsSync(dejavuPath);

      if (!hasDejaVu) {
        this.logger.warn(
          'DejaVuSans.ttf not found — using Helvetica fallback. Run scripts/download-fonts.sh to install.',
        );
      }

      if (hasDejaVu) doc.registerFont('DejaVu', dejavuPath);
      const latinFont = hasDejaVu ? 'DejaVu' : 'Helvetica';

      const formatDate = (d: string | Date | null): string => {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        return date.toLocaleDateString('fr-MA', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      // ── Title bar ────────────────────────────────────────────────────────────
      doc
        .font('DejaVu')
        .fontSize(18)
        .fillColor('#1a5276')
        .text('TERROIR.MA — Plateforme de Certification SDOQ', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1a5276');
      doc.moveDown(0.5);

      doc
        .font('DejaVu')
        .fontSize(14)
        .fillColor('#000')
        .text("CERTIFICAT D'EXPORTATION", { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
      doc.moveDown(0.5);

      // ── Field helper ─────────────────────────────────────────────────────────
      const field = (label: string, value: string): void => {
        doc.font(latinFont).fontSize(10).fillColor('#555').text(`${label}:  `, { continued: true });
        doc.font(latinFont).fontSize(10).fillColor('#000').text(value);
      };

      // ── Export document fields ────────────────────────────────────────────────
      field('Référence export', exportDoc.id);
      field('Référence ONSSA', exportDoc.onssaReference ?? '—');

      if (cert) {
        field('N° Certificat SDOQ', cert.certificationNumber ?? '—');
        field('Coopérative', cert.cooperativeName);
        field('Produit', cert.productTypeCode);
        field('Type SDOQ', cert.certificationType);
        field('Région', cert.regionCode);
      }

      field('Pays de destination', exportDoc.destinationCountry);
      field('Code SH (HS)', exportDoc.hsCode);
      field('Quantité (kg)', String(exportDoc.quantityKg));
      field('Destinataire', exportDoc.consigneeName);
      field('Pays destinataire', exportDoc.consigneeCountry);
      field('Statut', exportDoc.status.toUpperCase());
      field("Valide jusqu'au", formatDate(exportDoc.validUntil));

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
      doc.moveDown(0.5);

      doc
        .font('DejaVu')
        .fontSize(8)
        .fillColor('#888')
        .text(`Généré le ${formatDate(new Date())} — Terroir.ma`, { align: 'center' });

      doc.end();
    });
  }
}
