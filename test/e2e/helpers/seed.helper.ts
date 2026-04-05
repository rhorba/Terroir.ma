/**
 * E2E seed helper — inserts required reference data and test fixtures
 * before E2E test suites run against the full application.
 */

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { COOPERATIVE_FIXTURES } from '../../fixtures/cooperative.fixture';
import { NOTIFICATION_TEMPLATE_FIXTURES } from '../../fixtures/notification-templates.fixture';
import { seedRows, truncateTables } from '../../helpers/database.helper';

/**
 * Seed all reference data needed for E2E tests.
 * Call once in beforeAll after the app is initialized.
 */
export async function seedE2EData(app: INestApplication): Promise<void> {
  const dataSource = app.get<DataSource>(DataSource);

  // Cooperatives (stable UUIDs — referenced by other test data)
  await seedRows(dataSource, 'cooperative', 'cooperative', COOPERATIVE_FIXTURES);

  // Notification templates
  await seedRows(dataSource, 'notification', 'notification_template', NOTIFICATION_TEMPLATE_FIXTURES);
}

/**
 * Tear down all test data after E2E suite completes.
 */
export async function clearE2EData(app: INestApplication): Promise<void> {
  const dataSource = app.get<DataSource>(DataSource);
  await truncateTables(dataSource, ['cooperative', 'product', 'certification', 'notification']);
}
