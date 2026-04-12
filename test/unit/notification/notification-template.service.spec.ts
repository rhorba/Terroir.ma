import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { NotificationTemplateService } from '../../../src/modules/notification/services/notification-template.service';
import { NotificationTemplate } from '../../../src/modules/notification/entities/notification-template.entity';

const makeRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn().mockImplementation((dto) => ({ id: 'tmpl-uuid', ...dto })),
  save: jest.fn().mockImplementation(async (entity) => entity),
  count: jest.fn().mockResolvedValue(0),
});

const buildTemplate = (overrides: Partial<NotificationTemplate> = {}): NotificationTemplate =>
  ({
    id: 'tmpl-uuid',
    code: 'certification-granted',
    channel: 'email',
    language: 'fr-MA',
    subjectTemplate: 'Certificat délivré',
    bodyTemplate: '<p>Bonjour {{name}}</p>',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as NotificationTemplate;

describe('NotificationTemplateService', () => {
  let service: NotificationTemplateService;
  let templateRepo: ReturnType<typeof makeRepo>;
  let cacheManager: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    templateRepo = makeRepo();
    cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationTemplateService,
        { provide: getRepositoryToken(NotificationTemplate), useValue: templateRepo },
        { provide: CACHE_MANAGER, useValue: cacheManager },
      ],
    }).compile();

    service = module.get<NotificationTemplateService>(NotificationTemplateService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit()', () => {
    it('calls seedFromFiles without throwing when templates dir does not exist', async () => {
      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('findAll()', () => {
    it('returns all templates when no filters provided', async () => {
      const templates = [buildTemplate()];
      templateRepo.find.mockResolvedValue(templates);

      const result = await service.findAll({});

      expect(templateRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { code: 'ASC', language: 'ASC' },
      });
      expect(result).toEqual(templates);
    });

    it('passes code/channel/language filters to repo', async () => {
      templateRepo.find.mockResolvedValue([]);

      await service.findAll({ code: 'cert-granted', channel: 'email', language: 'fr-MA' });

      expect(templateRepo.find).toHaveBeenCalledWith({
        where: { code: 'cert-granted', channel: 'email', language: 'fr-MA' },
        order: { code: 'ASC', language: 'ASC' },
      });
    });
  });

  describe('findById()', () => {
    it('returns template when found', async () => {
      const template = buildTemplate();
      templateRepo.findOne.mockResolvedValue(template);

      const result = await service.findById('tmpl-uuid');

      expect(result).toEqual(template);
    });

    it('throws NotFoundException when template not found', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('missing-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create()', () => {
    it('creates template with isActive defaulting to true', async () => {
      const dto = {
        code: 'cert-granted',
        channel: 'email',
        language: 'fr-MA',
        bodyTemplate: '<p>Hi</p>',
      };
      const saved = buildTemplate(dto);
      templateRepo.save.mockResolvedValue(saved);

      const result = await service.create(dto);

      expect(templateRepo.create).toHaveBeenCalledWith({ ...dto, isActive: true });
      expect(result).toEqual(saved);
    });
  });

  describe('update()', () => {
    it('merges fields and invalidates Redis cache key', async () => {
      const existing = buildTemplate();
      const dto = { bodyTemplate: '<p>Updated</p>' };
      const updated = buildTemplate({ ...existing, ...dto });

      templateRepo.findOne.mockResolvedValue(existing);
      templateRepo.save.mockResolvedValue(updated);

      const result = await service.update('tmpl-uuid', dto);

      expect(templateRepo.save).toHaveBeenCalledWith({ ...existing, ...dto });
      expect(cacheManager.del).toHaveBeenCalledWith(
        `template:${updated.code}:${updated.channel}:${updated.language}`,
      );
      expect(result).toEqual(updated);
    });
  });

  describe('deactivate()', () => {
    it('sets isActive to false and invalidates Redis cache key', async () => {
      const existing = buildTemplate();
      const deactivated = buildTemplate({ isActive: false });

      templateRepo.findOne.mockResolvedValue(existing);
      templateRepo.save.mockResolvedValue(deactivated);

      const result = await service.deactivate('tmpl-uuid');

      expect(templateRepo.save).toHaveBeenCalledWith({ ...existing, isActive: false });
      expect(cacheManager.del).toHaveBeenCalledWith(
        `template:${deactivated.code}:${deactivated.channel}:${deactivated.language}`,
      );
      expect(result.isActive).toBe(false);
    });
  });

  describe('seed()', () => {
    it('returns { seeded: 0 } when templates dir does not exist', async () => {
      const result = await service.seed();
      expect(result).toEqual({ seeded: 0 });
    });
  });
});
