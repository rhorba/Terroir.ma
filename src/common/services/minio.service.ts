import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

/**
 * MinIO object storage service.
 * Wraps @aws-sdk/client-s3 for S3-compatible MinIO operations.
 * Bucket is auto-created on module init if it does not exist.
 */
@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = config.get<string>('minio.endpoint', 'localhost');
    const port = config.get<number>('minio.port', 9000);
    const useSsl = config.get<boolean>('minio.useSsl', false);
    this.bucket = config.get<string>('minio.bucket', 'terroir-uploads');

    this.client = new S3Client({
      endpoint: `${useSsl ? 'https' : 'http'}://${endpoint}:${port}`,
      region: 'us-east-1', // required by S3 client, ignored by MinIO
      credentials: {
        accessKeyId: config.get<string>('minio.accessKey', 'minioadmin'),
        secretAccessKey: config.get<string>('minio.secretKey', 'minioadmin'),
      },
      forcePathStyle: true, // required for MinIO
    });
  }

  /** Ensure the bucket exists on startup. Degrades gracefully if MinIO is unreachable. */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`MinIO bucket '${this.bucket}' already exists`);
    } catch (headErr: unknown) {
      const statusCode = (headErr as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (statusCode === 404) {
        // Bucket missing but MinIO is reachable — create it
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`MinIO bucket '${this.bucket}' created`);
      } else {
        // MinIO unreachable (ECONNREFUSED, timeout, etc.) — log and continue
        this.logger.warn(
          { err: (headErr as Error).message },
          `MinIO unreachable on startup — file storage will be unavailable until MinIO is running`,
        );
      }
    }
  }

  /**
   * Upload a file buffer to MinIO.
   * @param key   Object key (path within bucket)
   * @param buffer File contents
   * @param mimeType Content-Type header
   */
  async uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    this.logger.log({ key }, 'File uploaded to MinIO');
  }

  /**
   * Retrieve a file as a readable stream from MinIO.
   * @param key Object key
   */
  async getFileStream(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return response.Body as Readable;
  }

  /**
   * Delete a file from MinIO.
   * @param key Object key
   */
  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.log({ key }, 'File deleted from MinIO');
  }
}
