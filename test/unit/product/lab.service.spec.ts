import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { LabService } from '../../../src/modules/product/services/lab.service';
import { Lab } from '../../../src/modules/product/entities/lab.entity';

const makeRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

describe('LabService', () => {
  let service: LabService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [LabService, { provide: getRepositoryToken(Lab), useValue: repo }],
    }).compile();

    service = module.get<LabService>(LabService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('saves a new lab with isAccredited false', async () => {
      const lab = { id: 'lab-1', name: 'ONSSA Lab', isAccredited: false } as Lab;
      repo.create.mockReturnValue(lab);
      repo.save.mockResolvedValue(lab);

      const result = await service.create({ name: 'ONSSA Lab' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'ONSSA Lab', isAccredited: false }),
      );
      expect(result.name).toBe('ONSSA Lab');
    });
  });

  // ─── findById() ────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the lab when found', async () => {
      const lab = { id: 'lab-1', name: 'ONSSA Lab' } as Lab;
      repo.findOne.mockResolvedValue(lab);

      const result = await service.findById('lab-1');
      expect(result).toEqual(lab);
    });

    it('throws NotFoundException when lab not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── accredit() ────────────────────────────────────────────────────────────

  describe('accredit()', () => {
    it('sets isAccredited true and records accreditedAt', async () => {
      const lab = { id: 'lab-1', isAccredited: false } as Lab;
      const accreditedLab = { ...lab, isAccredited: true, accreditedAt: new Date() } as Lab;
      repo.findOne
        .mockResolvedValueOnce(lab) // first call in accredit() → findById()
        .mockResolvedValueOnce(accreditedLab); // second call after update → findById()
      repo.update.mockResolvedValue({ affected: 1 });

      const result = await service.accredit('lab-1');

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'lab-1' },
        expect.objectContaining({ isAccredited: true }),
      );
      expect(result.isAccredited).toBe(true);
    });

    it('throws ConflictException when lab is already accredited', async () => {
      const lab = { id: 'lab-1', isAccredited: true } as Lab;
      repo.findOne.mockResolvedValue(lab);

      await expect(service.accredit('lab-1')).rejects.toThrow(ConflictException);
    });
  });

  // ─── revoke() ──────────────────────────────────────────────────────────────

  describe('revoke()', () => {
    it('sets isAccredited false', async () => {
      const lab = { id: 'lab-1', isAccredited: true } as Lab;
      const revokedLab = { ...lab, isAccredited: false, accreditedAt: null } as Lab;
      repo.findOne.mockResolvedValueOnce(lab).mockResolvedValueOnce(revokedLab);
      repo.update.mockResolvedValue({ affected: 1 });

      const result = await service.revoke('lab-1');

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'lab-1' },
        expect.objectContaining({ isAccredited: false }),
      );
      expect(result.isAccredited).toBe(false);
    });

    it('throws ConflictException when lab is not accredited', async () => {
      const lab = { id: 'lab-1', isAccredited: false } as Lab;
      repo.findOne.mockResolvedValue(lab);

      await expect(service.revoke('lab-1')).rejects.toThrow(ConflictException);
    });
  });
});
