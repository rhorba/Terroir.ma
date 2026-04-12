/**
 * Integration test: Product module with real PostgreSQL.
 * Tests product registration, batch creation, and lab test result persistence.
 */

import { Product } from '../../../src/modules/product/entities/product.entity';
import { ProductType } from '../../../src/modules/product/entities/product-type.entity';
import { ProductionBatch } from '../../../src/modules/product/entities/production-batch.entity';
import { Harvest } from '../../../src/modules/product/entities/harvest.entity';
import { LabTest } from '../../../src/modules/product/entities/lab-test.entity';
import { LabTestResult } from '../../../src/modules/product/entities/lab-test-result.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';
import { truncateTables } from '../../helpers/database.helper';
import { buildProductBatch } from '../../factories/product.factory';

describe('Product (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([
      Product,
      ProductType,
      Harvest,
      ProductionBatch,
      LabTest,
      LabTestResult,
    ]);
  });

  afterEach(async () => {
    await truncateTables(db.dataSource, ['product']);
  });

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  describe('ProductionBatch persistence', () => {
    it('should persist a batch with correct batch number', async () => {
      const repo = db.dataSource.getRepository(ProductionBatch);
      const data = buildProductBatch();

      const saved = await repo.save(repo.create(data));
      const found = await repo.findOneBy({ id: saved.id });

      expect(found).not.toBeNull();
      expect(found!.batchNumber).toBe(data.batchNumber);
    });

    it('should store processing date correctly', async () => {
      const repo = db.dataSource.getRepository(ProductionBatch);

      const octoberBatch = buildProductBatch({
        overrides: {
          processingDate: '2025-10-15',
        },
      });

      const saved = await repo.save(repo.create(octoberBatch));
      const found = await repo.findOneBy({ id: saved.id });
      expect(found!.processingDate).toBe('2025-10-15');
    });
  });
});
