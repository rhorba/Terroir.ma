import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductController } from './controllers/product.controller';
import { HarvestController } from './controllers/harvest.controller';
import { BatchController } from './controllers/batch.controller';
import { LabTestController } from './controllers/lab-test.controller';
import { ProductService } from './services/product.service';
import { HarvestService } from './services/harvest.service';
import { BatchService } from './services/batch.service';
import { LabTestService } from './services/lab-test.service';
import { Product } from './entities/product.entity';
import { ProductType } from './entities/product-type.entity';
import { Harvest } from './entities/harvest.entity';
import { ProductionBatch } from './entities/production-batch.entity';
import { LabTest } from './entities/lab-test.entity';
import { LabTestResult } from './entities/lab-test-result.entity';
import { ProductProducer } from './events/product.producer';
import { ProductListener } from './listeners/product.listener';

/**
 * Product module — manages product catalog, harvest logging, batch creation, and lab tests.
 * PostgreSQL schema: product
 * Publishes: product.harvest.logged, product.batch.created, lab.test.submitted
 * Consumes: lab.test.completed
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductType,
      Harvest,
      ProductionBatch,
      LabTest,
      LabTestResult,
    ]),
  ],
  controllers: [
    ProductController,
    HarvestController,
    BatchController,
    LabTestController,
    ProductListener,
  ],
  providers: [
    ProductService,
    HarvestService,
    BatchService,
    LabTestService,
    ProductProducer,
  ],
  exports: [],
})
export class ProductModule {}
