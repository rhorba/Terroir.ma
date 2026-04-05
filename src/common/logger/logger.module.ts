import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('app.logLevel', 'info'),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.body.password',
              'req.body.cin',
              'req.body.phone',
              'req.body.email',
            ],
            censor: '[REDACTED]',
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
