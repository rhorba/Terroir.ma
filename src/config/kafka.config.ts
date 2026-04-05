import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  brokers: (process.env.KAFKA_BROKERS ?? 'localhost:19092').split(','),
  clientId: 'terroir-ma',
  consumerGroups: {
    cooperative: 'cooperative-group',
    product: 'product-group',
    certification: 'certification-group',
    notification: 'notification-group',
  },
}));
