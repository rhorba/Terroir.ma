import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as path from 'path';
import { existsSync } from 'fs';
import { Certification, CertificationStatus } from '../entities/certification.entity';
import { QrCode } from '../entities/qr-code.entity';

/**
 * Generates a trilingual (FR / AR / ZGH) PDF conformity certificate using PDFKit.
 *
 * Font assets required at runtime (see assets/fonts/README.md):
 *   - assets/fonts/Amiri-Regular.ttf  (Arabic, OFL licensed)
 *   - assets/fonts/DejaVuSans.ttf     (Latin + Tifinagh, free license)
 *
 * US-047
 */
@Injectable()
export class CertificationPdfService {
  private readonly logger = new Logger(CertificationPdfService.name);
  private readonly fontsDir = path.join(process.cwd(), 'assets', 'fonts');

  constructor(
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    @InjectRepository(QrCode)
    private readonly qrCodeRepo: Repository<QrCode>,
  ) {}

  /**
   * Generates a PDF certificate for a GRANTED or RENEWED certification.
   * Returns a Buffer suitable for StreamableFile.
   */
  async generateCertificatePdf(certificationId: string): Promise<Buffer> {
    const cert = await this.certRepo.findOne({ where: { id: certificationId } });
    if (!cert) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_FOUND',
        message: `Certification ${certificationId} not found`,
      });
    }
    if (
      cert.currentStatus !== CertificationStatus.GRANTED &&
      cert.currentStatus !== CertificationStatus.RENEWED
    ) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_GRANTED',
        message: 'PDF only available for GRANTED or RENEWED certifications',
      });
    }

    const qrCode = await this.qrCodeRepo.findOne({
      where: { certificationId, isActive: true },
    });

    const verifyUrl = qrCode?.verificationUrl ?? '';
    const qrBuffer = verifyUrl ? await QRCode.toBuffer(verifyUrl, { width: 80 }) : null;

    return this.buildPdf(cert, qrBuffer);
  }

  private buildPdf(cert: Certification, qrBuffer: Buffer | null): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const amiriPath = path.join(this.fontsDir, 'Amiri-Regular.ttf');
      const dejavuPath = path.join(this.fontsDir, 'DejaVuSans.ttf');
      const hasAmiri = existsSync(amiriPath);
      const hasDejaVu = existsSync(dejavuPath);

      if (!hasDejaVu) {
        this.logger.warn(
          'DejaVuSans.ttf not found — using Helvetica fallback. Run scripts/download-fonts.sh to install.',
        );
      }
      if (!hasAmiri) {
        this.logger.warn(
          'Amiri-Regular.ttf not found — Arabic block will use Helvetica. Run scripts/download-fonts.sh.',
        );
      }

      if (hasDejaVu) doc.registerFont('DejaVu', dejavuPath);
      if (hasAmiri) doc.registerFont('Amiri', amiriPath);

      const latinFont = hasDejaVu ? 'DejaVu' : 'Helvetica';
      const arabicFont = hasAmiri ? 'Amiri' : 'Helvetica';

      const formatDate = (d: string | Date | null): string => {
        if (!d) return '—';
        const date = typeof d === 'string' ? new Date(d) : d;
        return date.toLocaleDateString('fr-MA', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      };

      // ── Title bar ───────────────────────────────────────────────────────────
      doc
        .font('DejaVu')
        .fontSize(18)
        .fillColor('#1a5276')
        .text('TERROIR.MA — Plateforme de Certification SDOQ', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#1a5276');
      doc.moveDown(0.5);

      // ── Trilingual header ────────────────────────────────────────────────────
      doc.font(latinFont).fontSize(14).fillColor('#000').text('CERTIFICAT DE CONFORMITÉ', {
        align: 'center',
      });
      doc.font(arabicFont).fontSize(14).text('شهادة المطابقة', { align: 'right' });
      doc.font(latinFont).fontSize(12).text('ⴰⵙⵉⴼⵍⵍ ⵏ ⵓⵎⴷⵢⴰⵣ', { align: 'center' });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
      doc.moveDown(0.5);

      // ── Certificate fields ───────────────────────────────────────────────────
      const field = (labelFr: string, labelAr: string, value: string): void => {
        doc
          .font('DejaVu')
          .fontSize(10)
          .fillColor('#555')
          .text(`${labelFr} / `, { continued: true });
        doc
          .font(arabicFont)
          .fontSize(10)
          .fillColor('#555')
          .text(`${labelAr}:  `, { continued: true });
        doc.font(latinFont).fontSize(10).fillColor('#000').text(value);
      };

      field('Numéro', 'رقم الشهادة', cert.certificationNumber ?? '—');
      field('Coopérative', 'التعاونية', cert.cooperativeName);
      field('Produit', 'المنتج', cert.productTypeCode);
      field('Type SDOQ', 'نوع التصنيف', cert.certificationType);
      field('Région', 'الجهة', cert.regionCode);
      field(
        'Valide du',
        'صالح من',
        `${formatDate(cert.validFrom)} → ${formatDate(cert.validUntil)}`,
      );
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
      doc.moveDown(0.5);

      // ── QR code ─────────────────────────────────────────────────────────────
      if (qrBuffer) {
        doc.image(qrBuffer, { fit: [80, 80], align: 'center' });
        doc.moveDown(0.3);
        doc
          .font('DejaVu')
          .fontSize(8)
          .fillColor('#888')
          .text('Scanner pour vérifier / امسح للتحقق', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#aaa');
        doc.moveDown(0.5);
      }

      // ── Issue date ───────────────────────────────────────────────────────────
      field('Délivré le', 'تاريخ الإصدار', formatDate(cert.grantedAt));

      doc.end();
    });
  }
}
