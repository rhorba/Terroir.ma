import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PagedResult } from '../../../common/dto/pagination.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExportDocument } from '../entities/export-document.entity';
import { Certification, CertificationStatus } from '../entities/certification.entity';
import { RequestExportDocumentDto } from '../dto/request-export-document.dto';
import { CertificationProducer } from '../events/certification.producer';

/**
 * Export document service — generates phytosanitary/COO export documents via ONSSA.
 */
@Injectable()
export class ExportDocumentService {
  private readonly logger = new Logger(ExportDocumentService.name);

  constructor(
    @InjectRepository(ExportDocument)
    private readonly exportDocRepo: Repository<ExportDocument>,
    @InjectRepository(Certification)
    private readonly certRepo: Repository<Certification>,
    private readonly producer: CertificationProducer,
  ) {}

  async requestExportDocument(
    dto: RequestExportDocumentDto,
    requestedBy: string,
    _correlationId: string,
  ): Promise<ExportDocument> {
    const certification = await this.certRepo.findOne({ where: { id: dto.certificationId } });
    if (!certification || certification.currentStatus !== CertificationStatus.GRANTED) {
      throw new NotFoundException({
        code: 'CERTIFICATION_NOT_FOUND_OR_NOT_GRANTED',
        message: 'Valid granted certification required for export document',
      });
    }

    const exportDoc = this.exportDocRepo.create({
      certificationId: dto.certificationId,
      cooperativeId: certification.cooperativeId,
      destinationCountry: dto.destinationCountry,
      hsCode: dto.hsCode,
      quantityKg: dto.quantityKg,
      consigneeName: dto.consigneeName,
      consigneeCountry: dto.consigneeCountry,
      requestedBy,
      status: 'submitted',
      onssaReference: null,
      validUntil: null,
      documentUrl: null,
    });

    const saved = await this.exportDocRepo.save(exportDoc);

    this.logger.log(
      { exportDocId: saved.id, certificationId: dto.certificationId },
      'Export document requested',
    );

    return saved;
  }

  async findById(id: string): Promise<ExportDocument> {
    const doc = await this.exportDocRepo.findOne({ where: { id } });
    if (!doc) {
      throw new NotFoundException({
        code: 'EXPORT_DOCUMENT_NOT_FOUND',
        message: `Export document ${id} not found`,
      });
    }
    return doc;
  }

  async findByCooperative(cooperativeId: string): Promise<ExportDocument[]> {
    return this.exportDocRepo.find({
      where: { cooperativeId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Returns paginated export documents for a cooperative.
   * Used by cooperative-admin to view export logistics status (US-066).
   */
  async findByCooperativePaginated(
    cooperativeId: string,
    page: number,
    limit: number,
  ): Promise<PagedResult<ExportDocument>> {
    const [data, total] = await this.exportDocRepo.findAndCount({
      where: { cooperativeId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { page, limit, total } };
  }

  async updateOnssaReference(id: string, onssaReference: string): Promise<ExportDocument> {
    await this.exportDocRepo.update({ id }, { onssaReference, status: 'approved' });
    return this.findById(id);
  }

  /** Alias used by ExportDocumentController */
  async generateDocument(
    dto: RequestExportDocumentDto,
    requestedBy: string,
  ): Promise<ExportDocument> {
    return this.requestExportDocument(dto, requestedBy, requestedBy);
  }

  /** Customs clearance — approve the export document */
  async validateDocument(id: string, validatedBy: string): Promise<ExportDocument> {
    const doc = await this.findById(id);
    const validUntilDate = new Date();
    validUntilDate.setMonth(validUntilDate.getMonth() + 6);
    const validUntil = validUntilDate.toISOString().split('T')[0] as string;
    await this.exportDocRepo.update({ id }, { status: 'approved', validUntil });

    this.logger.log({ exportDocId: id, validatedBy }, 'Export document validated');
    return this.findById(doc.id);
  }
}
