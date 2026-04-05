import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ExportDocument } from '../entities/export-document.entity';
import { Certification } from '../entities/certification.entity';
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
    correlationId: string,
  ): Promise<ExportDocument> {
    const certification = await this.certRepo.findOne({ where: { id: dto.certificationId } });
    if (!certification || certification.status !== 'granted') {
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

  async updateOnssaReference(id: string, onssaReference: string): Promise<ExportDocument> {
    await this.exportDocRepo.update({ id }, { onssaReference, status: 'approved' });
    return this.findById(id);
  }
}
