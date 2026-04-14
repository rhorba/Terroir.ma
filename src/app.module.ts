import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { validateEnv } from './config/env.validation';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import kafkaConfig from './config/kafka.config';
import keycloakConfig from './config/keycloak.config';
import redisConfig from './config/redis.config';
import minioConfig from './config/minio.config';
/* eslint-disable no-restricted-imports */
import { CooperativeModule } from './modules/cooperative/cooperative.module';
import { ProductModule } from './modules/product/product.module';
import { CertificationModule } from './modules/certification/certification.module';
import { NotificationModule } from './modules/notification/notification.module';
/* eslint-enable no-restricted-imports */
import { HealthController } from './health/health.controller';
import { UserController } from './common/controllers/user.controller';
import { AdminController } from './common/controllers/admin.controller';
import { KafkaAdminService } from './common/services/kafka-admin.service';
import { MinioService } from './common/services/minio.service';
import { DashboardService } from './common/services/dashboard.service';
import { AuditLogService } from './common/services/audit-log.service';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AuditLog } from './common/entities/audit-log.entity';
import { SystemSetting } from './common/entities/system-setting.entity';
import { SystemSettingsService } from './common/services/system-settings.service';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { KafkaClientModule } from './kafka/kafka-client.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, kafkaConfig, keycloakConfig, redisConfig, minioConfig],
      envFilePath: ['.env', '.env.local'],
      validate: validateEnv,
    }),

    // Logging
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get('app.logLevel', 'info'),
          redact: ['req.headers.authorization', 'body.password', 'body.cin', 'body.phone'],
          transport:
            configService.get('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
        },
      }),
      inject: [ConfigService],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('database.url'),
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get('NODE_ENV') === 'development',
        migrations: ['dist/migrations/*.js'],
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      { ttl: 900000, limit: 100 }, // 100 req per 15 min
    ]),

    // Health checks
    TerminusModule,

    // Redis cache (CACHE_MANAGER for DashboardService and other AppModule providers)
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        store: redisStore,
        url: config.get<string>('redis.url'),
        ttl: 0,
      }),
      inject: [ConfigService],
    }),

    // Kafka client (global — available to all domain modules)
    KafkaClientModule,

    // Common entities
    TypeOrmModule.forFeature([AuditLog, SystemSetting]),

    // Domain modules
    CooperativeModule,
    ProductModule,
    CertificationModule,
    NotificationModule,
  ],
  controllers: [HealthController, UserController, AdminController],
  providers: [
    KafkaAdminService,
    MinioService,
    DashboardService,
    AuditLogService,
    SystemSettingsService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
