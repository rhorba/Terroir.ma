import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Harvest } from '../entities/harvest.entity';
import { LogHarvestDto } from '../dto/log-harvest.dto';
import { ProductProducer } from '../events/product.producer';

/**
 * Harvest service — logs harvest records for cooperative farms.
 * Each harvest is linked to a farm, cooperative and product type.
 */
@Injectable()
export class HarvestService {
  constructor(
    @InjectRepository(Harvest)
    private readonly harvestRepo: Repository<Harvest>,
    private readonly producer: ProductProducer,
  ) {}

  /**
   * Compute the agricultural campaign year from a harvest date.
   * Morocco's campaign runs October → September.
   * A harvest on 2025-10-01 → "2025/2026"; on 2025-09-30 → "2024/2025".
   */
  static computeCampaignYear(harvestDate: string): string {
    const date = new Date(harvestDate);
    const month = date.getUTCMonth() + 1; // 1-indexed
    const year = date.getUTCFullYear();
    const startYear = month >= 10 ? year : year - 1;
    return `${startYear}/${startYear + 1}`;
  }

  /**
   * Log a new harvest record.
   * Campaign year is always derived from harvestDate (Oct–Sep boundary).
   * Publishes product.harvest.logged Kafka event.
   */
  async logHarvest(
    dto: LogHarvestDto,
    cooperativeId: string,
    createdBy: string,
  ): Promise<Harvest> {
    const campaignYear = HarvestService.computeCampaignYear(dto.harvestDate);
    const harvest = this.harvestRepo.create({
      ...dto,
      campaignYear,
      metadata: dto.metadata ?? null,
      cooperativeId,
      createdBy,
    });
    const saved = await this.harvestRepo.save(harvest);
    await this.producer.publishHarvestLogged(saved, createdBy);
    return saved;
  }

  async findByFarm(farmId: string): Promise<Harvest[]> {
    return this.harvestRepo.find({ where: { farmId } });
  }

  async findById(id: string): Promise<Harvest> {
    const harvest = await this.harvestRepo.findOne({ where: { id } });
    if (!harvest) {
      throw new NotFoundException({
        code: 'HARVEST_NOT_FOUND',
        message: `Harvest ${id} not found`,
      });
    }
    return harvest;
  }

  async findByCooperative(
    cooperativeId: string,
    campaignYear?: string,
  ): Promise<Harvest[]> {
    const query = this.harvestRepo.createQueryBuilder('harvest')
      .where('harvest.cooperative_id = :cooperativeId', { cooperativeId });

    if (campaignYear) {
      query.andWhere('harvest.campaign_year = :campaignYear', { campaignYear });
    }

    return query.orderBy('harvest.harvest_date', 'DESC').getMany();
  }
}
