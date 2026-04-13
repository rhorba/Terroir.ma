import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface RedpandaTopic {
  name: string;
}

interface PartitionInfo {
  id: number;
  high_watermark: number;
}

export interface DlqTopicStats {
  topic: string;
  totalMessages: number;
}

/**
 * Calls the Redpanda Admin HTTP API to retrieve DLQ topic message counts.
 * US-087: super-admin dashboard — detect processing failures.
 * DLQ topics follow the naming convention: <topic>.dlq
 */
@Injectable()
export class KafkaAdminService {
  private readonly logger = new Logger(KafkaAdminService.name);
  private readonly adminUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.adminUrl = this.configService.get<string>('REDPANDA_ADMIN_URL', 'http://redpanda:9644');
  }

  /**
   * Returns message counts for all DLQ topics (topics ending in .dlq).
   * Uses Redpanda Admin REST API v1.
   * Gracefully returns [] if the Admin API is unreachable.
   */
  async getDlqStats(): Promise<DlqTopicStats[]> {
    try {
      const topicsRes = await fetch(`${this.adminUrl}/v1/topics`);
      const topics = (await topicsRes.json()) as RedpandaTopic[];

      const dlqTopics = topics.filter((t) => t.name.endsWith('.dlq'));

      const stats = await Promise.all(
        dlqTopics.map(async (topic): Promise<DlqTopicStats> => {
          try {
            const partRes = await fetch(`${this.adminUrl}/v1/topics/${topic.name}/partitions`);
            const partitions = (await partRes.json()) as PartitionInfo[];
            const totalMessages = partitions.reduce((sum, p) => sum + (p.high_watermark ?? 0), 0);
            return { topic: topic.name, totalMessages };
          } catch {
            this.logger.warn({ topic: topic.name }, 'Failed to fetch partition info for DLQ topic');
            return { topic: topic.name, totalMessages: -1 };
          }
        }),
      );

      return stats;
    } catch (error) {
      this.logger.error({ error }, 'Failed to reach Redpanda Admin API');
      return [];
    }
  }
}
