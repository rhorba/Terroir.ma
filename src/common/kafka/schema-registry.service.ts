import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchemaRegistry, SchemaType } from '@kafkajs/confluent-schema-registry';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SchemaRegistryService {
  private readonly logger = new Logger(SchemaRegistryService.name);
  private readonly registry: SchemaRegistry;
  private readonly schemaIdCache = new Map<string, number>();
  private registered = false;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SCHEMA_REGISTRY_URL', 'http://localhost:8081');
    this.registry = new SchemaRegistry({ host });
  }

  async encode<T>(subject: string, payload: T): Promise<Buffer> {
    const schemaId = this.schemaIdCache.get(subject);
    if (schemaId === undefined) {
      throw new Error(`No schema registered for subject "${subject}". Call registerAll() first.`);
    }
    return this.registry.encode(schemaId, payload);
  }

  async decode<T>(buffer: Buffer): Promise<T> {
    return this.registry.decode(buffer) as Promise<T>;
  }

  async registerAll(): Promise<void> {
    if (this.registered) return;

    const schemaDir = path.join(__dirname, '../schemas/avro');
    let files: string[];
    try {
      files = fs.readdirSync(schemaDir).filter((f) => f.endsWith('.avsc'));
    } catch {
      this.logger.warn({ schemaDir }, 'Avro schema directory not found — skipping registration');
      return;
    }

    const registryUrl = this.configService.get<string>(
      'SCHEMA_REGISTRY_URL',
      'http://localhost:8081',
    );

    for (const file of files) {
      const topic = file.replace('.avsc', '');
      const subject = `${topic}-value`;
      const schemaContent = fs.readFileSync(path.join(schemaDir, file), 'utf8');

      try {
        await fetch(`${registryUrl}/config/${subject}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/vnd.schemaregistry.v1+json' },
          body: JSON.stringify({ compatibility: 'BACKWARD' }),
        });

        const { id } = await this.registry.register(
          { type: SchemaType.AVRO, schema: schemaContent },
          { subject },
        );
        this.schemaIdCache.set(subject, id);
        this.logger.log({ subject, schemaId: id }, 'Avro schema registered');
      } catch (error) {
        this.logger.error({ error, subject }, 'Failed to register Avro schema');
        throw error;
      }
    }

    this.registered = true;
    this.logger.log({ count: files.length }, 'All Avro schemas registered');
  }
}
