import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CertificationService } from './services/certification.service';
import { InspectionService } from './services/inspection.service';
import { QrCodeService } from './services/qr-code.service';
import { ExportDocumentService } from './services/export-document.service';
import { CertificationPdfService } from './services/certification-pdf.service';
import { ExportDocumentPdfService } from './services/export-document-pdf.service';
import { CertificationController } from './controllers/certification.controller';
import { InspectionController } from './controllers/inspection.controller';
import { QrCodeController } from './controllers/qr-code.controller';
import { ExportDocumentController } from './controllers/export-document.controller';
import { CertificationListener } from './listeners/certification.listener';
import { CertificationProducer } from './events/certification.producer';
import { Certification } from './entities/certification.entity';
import { CertificationEvent } from './entities/certification-event.entity';
import { Inspection } from './entities/inspection.entity';
import { InspectionReport } from './entities/inspection-report.entity';
import { QrCode } from './entities/qr-code.entity';
import { ExportDocument } from './entities/export-document.entity';

/**
 * Certification module — 12-step SDOQ certification workflow.
 * PostgreSQL schema: certification
 * Consumer group: certification-group
 * Consumes: lab.test.completed, cooperative.registration.verified
 * Publishes: certification.requested, certification.inspection.scheduled,
 *            certification.decision.granted, certification.decision.denied,
 *            certification.revoked, certification.qrcode.generated,
 *            export.document.requested, export.document.validated
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Certification,
      CertificationEvent,
      Inspection,
      InspectionReport,
      QrCode,
      ExportDocument,
    ]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        store: redisStore,
        url: config.get<string>('redis.url'),
        ttl: 0,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    CertificationController,
    InspectionController,
    QrCodeController,
    ExportDocumentController,
    CertificationListener,
  ],
  providers: [
    CertificationService,
    InspectionService,
    QrCodeService,
    ExportDocumentService,
    CertificationPdfService,
    ExportDocumentPdfService,
    CertificationProducer,
  ],
  exports: [],
})
export class CertificationModule {}
