/**
 * Standalone script to export the OpenAPI document as JSON.
 * Usage: npx ts-node -r tsconfig-paths/register src/scripts/export-openapi.ts
 * Output: docs/api/openapi.json
 */
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../app.module';

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });

  const config = new DocumentBuilder()
    .setTitle('Terroir.ma API')
    .setDescription('SDOQ terroir product certification platform — Morocco Law 25-06')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = join(process.cwd(), 'docs', 'api');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'openapi.json'), JSON.stringify(document, null, 2));

  console.log('OpenAPI document written to docs/api/openapi.json');
  await app.close();
  process.exit(0);
}

exportOpenApi().catch((err: unknown) => {
  console.error('Failed to export OpenAPI:', err);
  process.exit(1);
});
