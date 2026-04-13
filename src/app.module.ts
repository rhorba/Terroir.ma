import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
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
import { KafkaClientModule } from './kafka/kafka-client.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, kafkaConfig, keycloakConfig, redisConfig, minioConfig],
      envFilePath: ['.env', '.env.local'],
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

    // Kafka client (global — available to all domain modules)
    KafkaClientModule,

    // Domain modules
    CooperativeModule,
    ProductModule,
    CertificationModule,
    NotificationModule,
  ],
  controllers: [HealthController, UserController, AdminController],
  providers: [KafkaAdminService, MinioService],
})
export class AppModule {}
