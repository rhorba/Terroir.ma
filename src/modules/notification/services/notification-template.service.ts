import { Injectable, NotFoundException, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import * as fs from 'fs';
import * as path from 'path';
import { NotificationTemplate } from '../entities/notification-template.entity';
import { CreateNotificationTemplateDto } from '../dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from '../dto/update-notification-template.dto';

/**
 * Manages notification templates with DB-override + file fallback pattern.
 *
 * Lookup order: Redis cache → DB record → .hbs file in assets/templates/
 * File naming convention: {code}.{channel}.{language}.hbs
 * Redis cache key: template:{code}:{channel}:{language}, TTL 600s
 *
 * US-075
 */
@Injectable()
export class NotificationTemplateService implements OnModuleInit {
  private readonly logger = new Logger(NotificationTemplateService.name);
  private readonly templatesDir = path.join(process.cwd(), 'assets', 'templates');

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templateRepo: Repository<NotificationTemplate>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /** On startup, seed DB from .hbs files for any missing template records. */
  async onModuleInit(): Promise<void> {
    await this.seedFromFiles();
  }

  private async seedFromFiles(): Promise<void> {
    if (!fs.existsSync(this.templatesDir)) return;
    const files = fs.readdirSync(this.templatesDir).filter((f) => f.endsWith('.hbs'));
    for (const file of files) {
      // filename convention: {code}.{channel}.{language}.hbs
      const parts = file.replace('.hbs', '').split('.');
      if (parts.length < 3) continue;
      const language = parts.pop()!;
      const channel = parts.pop()!;
      const code = parts.join('.');
      const exists = await this.templateRepo.findOne({ where: { code, channel, language } });
      if (!exists) {
        const bodyTemplate = fs.readFileSync(path.join(this.templatesDir, file), 'utf8');
        await this.templateRepo.save(
          this.templateRepo.create({ code, channel, language, bodyTemplate, isActive: true }),
        );
        this.logger.log({ code, channel, language }, 'Template seeded from file');
      }
    }
  }

  async findAll(filters: {
    code?: string;
    channel?: string;
    language?: string;
  }): Promise<NotificationTemplate[]> {
    const where: FindOptionsWhere<NotificationTemplate> = {};
    if (filters.code) where.code = filters.code;
    if (filters.channel) where.channel = filters.channel;
    if (filters.language) where.language = filters.language;
    return this.templateRepo.find({ where, order: { code: 'ASC', language: 'ASC' } });
  }

  async findById(id: string): Promise<NotificationTemplate> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: `Template ${id} not found`,
      });
    }
    return t;
  }

  async create(dto: CreateNotificationTemplateDto): Promise<NotificationTemplate> {
    const template = this.templateRepo.create({ ...dto, isActive: dto.isActive ?? true });
    return this.templateRepo.save(template);
  }

  async update(id: string, dto: UpdateNotificationTemplateDto): Promise<NotificationTemplate> {
    const existing = await this.findById(id);
    const updated = await this.templateRepo.save({ ...existing, ...dto });
    await this.cacheManager.del(`template:${updated.code}:${updated.channel}:${updated.language}`);
    return updated;
  }

  /** Soft-delete: sets isActive = false and invalidates Redis cache. */
  async deactivate(id: string): Promise<NotificationTemplate> {
    const existing = await this.findById(id);
    const updated = await this.templateRepo.save({ ...existing, isActive: false });
    await this.cacheManager.del(`template:${updated.code}:${updated.channel}:${updated.language}`);
    return updated;
  }

  /** Manually trigger seed (useful after adding new .hbs files without restart). */
  async seed(): Promise<{ seeded: number }> {
    if (!fs.existsSync(this.templatesDir)) return { seeded: 0 };
    const before = await this.templateRepo.count();
    await this.seedFromFiles();
    const after = await this.templateRepo.count();
    return { seeded: after - before };
  }
}
