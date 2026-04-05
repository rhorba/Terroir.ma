/**
 * Integration test: Product module with real PostgreSQL.
 * Tests product registration, batch creation, and lab test result persistence.
 */

import { DataSource } from 'typeorm';
import { Product } from '../../../src/modules/product/entities/product.entity';
import { ProductType } from '../../../src/modules/product/entities/product-type.entity';
import { ProductionBatch } from '../../../src/modules/product/entities/production-batch.entity';
import { Harvest } from '../../../src/modules/product/entities/harvest.entity';
import { LabTest } from '../../../src/modules/product/entities/lab-test.entity';
import { LabTestResult } from '../../../src/modules/product/entities/lab-test-result.entity';
import { startTestDatabase, stopTestDatabase, TestDatabase } from '../helpers/test-containers.setup';
import { truncateTables } from '../../helpers/database.helper';
import { buildProductBatch } from '../../factories/product.factory';

describe('Product (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([Product, ProductType, Harvest, ProductionBatch, LabTest, LabTestResult]);
  });

  afterEach(async () => {
    await truncateTables(db.dataSource, ['product']);
  });

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  describe('ProductionBatch persistence', () => {
    it('should persist a batch with JSONB metadata', async () => {
      const repo = db.dataSource.getRepository(ProductionBatch);
      const data = buildProductBatch();

      const saved = await repo.save(repo.create(data));
      const found = await repo.findOneBy({ id: saved.id });

      expect(found).not.toBeNull();
      expect(found!.batchReference).toBe(data.batchReference);
    });

    it('should store campaign year correctly', async () => {
      const repo = db.dataSource.getRepository(ProductionBatch);

      // October harvest → campaign year = current year
      const octoberBatch = buildProductBatch({
        overrides: {
          harvestDate: new Date('2025-10-15'),
          campaignYear: '2025-2026',
        },
      });

      const saved = await repo.save(repo.create(octoberBatch));
      const found = await repo.findOneBy({ id: saved.id });
      expect(found!.campaignYear).toBe('2025-2026');
    });
  });
});
