import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const corsOrigins = configService
    .get<string>('app.corsOrigins', 'http://localhost:4200')
    .split(',');

  // Logger
  app.useLogger(app.get(Logger));

  // Security
  app.use(helmet());
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Global prefix
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });

  // Global pipes, filters, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new CorrelationIdInterceptor(),
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`Terroir.ma API running on port ${port}`, 'Bootstrap');
}

bootstrap();
