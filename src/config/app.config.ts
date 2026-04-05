import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  corsOrigins: process.env.CORS_ORIGINS ?? 'http://localhost:4200',
  timezone: 'Africa/Casablanca',
}));
