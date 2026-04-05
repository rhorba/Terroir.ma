import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url:
    process.env.DATABASE_URL ??
    'postgresql://terroir:terroir_pass@localhost:5432/terroir_db',
  schemas: ['cooperative', 'product', 'certification', 'notification'],
}));
