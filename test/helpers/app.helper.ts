import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { TestJwtStrategy } from './test-jwt.strategy';

/**
 * Mock Kafka client — swaps out the real Kafka connection in e2e tests.
 * Prevents test failures when Redpanda is not running.
 */
const mockKafkaClient = {
  emit: jest.fn().mockReturnValue(of(null)),
  send: jest.fn().mockReturnValue(of(null)),
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
  subscribeToResponseOf: jest.fn(),
};

/**
 * Bootstrap a full NestJS application for E2E tests.
 * The test database URL must be set via TEST_DATABASE_URL env var.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
    providers: [TestJwtStrategy],
  })
    .overrideProvider('KAFKA_CLIENT')
    .useValue(mockKafkaClient)
    .compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  // Create schemas and synchronize tables for test database
  const dataSource = app.get(DataSource);
  for (const schema of ['cooperative', 'product', 'certification', 'notification']) {
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  }
  await dataSource.synchronize();

  return app;
}

/**
 * Build a Bearer token header for Supertest requests.
 * In tests, Keycloak JWT validation is bypassed via a test AuthGuard.
 */
export function bearerHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Build a mock JWT string (not cryptographically signed — only for dev/test guard bypass).
 */
export function buildMockJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.`;
}
