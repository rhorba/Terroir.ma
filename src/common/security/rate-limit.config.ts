import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const rateLimitConfig: ThrottlerModuleOptions = [
  {
    name: 'default',
    ttl: 900000, // 15 minutes in ms
    limit: 100,
  },
  {
    name: 'auth',
    ttl: 900000,
    limit: 10,
  },
];
