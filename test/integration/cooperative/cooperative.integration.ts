/**
 * Integration test: Cooperative module with real PostgreSQL.
 * Tests cooperative creation, member addition, and farm mapping.
 */

import { Cooperative } from '../../../src/modules/cooperative/entities/cooperative.entity';
import { Member } from '../../../src/modules/cooperative/entities/member.entity';
import { Farm } from '../../../src/modules/cooperative/entities/farm.entity';
import {
  startTestDatabase,
  stopTestDatabase,
  TestDatabase,
} from '../helpers/test-containers.setup';
import { truncateTables } from '../../helpers/database.helper';
import { buildCooperative } from '../../factories/cooperative.factory';

describe('Cooperative (integration)', () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await startTestDatabase([Cooperative, Member, Farm]);
  });

  afterEach(async () => {
    await truncateTables(db.dataSource, ['cooperative']);
  });

  afterAll(async () => {
    await stopTestDatabase(db);
  });

  describe('Cooperative CRUD', () => {
    it('should persist a new cooperative', async () => {
      const repo = db.dataSource.getRepository(Cooperative);
      const data = buildCooperative();

      const saved = await repo.save(repo.create(data));
      const found = await repo.findOneBy({ id: saved.id });

      expect(found).not.toBeNull();
      expect(found!.name).toBe(data.name);
      expect(found!.verifiedAt).toBeNull();
    });

    it('should update verifiedAt timestamp', async () => {
      const repo = db.dataSource.getRepository(Cooperative);
      const data = buildCooperative();

      const saved = await repo.save(repo.create(data));
      await repo.update(saved.id, { verifiedAt: new Date() });

      const updated = await repo.findOneBy({ id: saved.id });
      expect(updated!.verifiedAt).not.toBeNull();
    });

    it('should enforce unique ice number', async () => {
      const repo = db.dataSource.getRepository(Cooperative);
      const data = buildCooperative({ overrides: { ice: '000000000000001' } });

      await repo.save(repo.create(data));

      const duplicate = repo.create({ ...buildCooperative(), ice: '000000000000001' });
      await expect(repo.save(duplicate)).rejects.toThrow();
    });
  });

  describe('ICE number validation (DB level)', () => {
    it('should persist valid 15-digit ICE', async () => {
      const repo = db.dataSource.getRepository(Cooperative);
      const data = buildCooperative({ overrides: { ice: '001234567890123' } });

      const saved = await repo.save(repo.create(data));
      expect(saved.ice).toBe('001234567890123');
    });
  });
});
