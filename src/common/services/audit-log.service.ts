import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  /**
   * Fire-and-forget write — never throws (logs error silently).
   * Called from AuditInterceptor; must not block the response.
   */
  async record(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    try {
      const log = this.auditRepo.create(entry);
      await this.auditRepo.save(log);
    } catch {
      // Silent — audit failure must never affect the request
    }
  }

  /**
   * US-085: Paginated audit log query for super-admin.
   */
  async findAll(
    query: AuditLogQueryDto,
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.userId) qb.andWhere('a.userId = :userId', { userId: query.userId });
    if (query.from) qb.andWhere('a.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('a.createdAt <= :to', { to: query.to });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
