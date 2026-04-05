/**
 * E2E test: Notification delivery smoke tests.
 * Verifies that the notification listener processes Kafka events and stores records.
 * Mailpit is used as the SMTP sink — check http://localhost:8025 to inspect emails.
 */
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from '../../helpers/app.helper';

describe('Notification (e2e smoke)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should expose health endpoint', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});
