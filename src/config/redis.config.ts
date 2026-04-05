import { registerAs } from '@nestjs/config';

export default registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  qrCacheTtl: 300, // 5 minutes
  certificationStatusTtl: 60, // 1 minute
}));
