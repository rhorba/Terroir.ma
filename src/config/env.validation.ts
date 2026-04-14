import * as Joi from 'joi';

/**
 * Joi schema for environment variable validation.
 * Wired into ConfigModule.forRoot({ validate }) in app.module.ts.
 * App refuses to start if any required variable is missing or malformed.
 */
export const envValidationSchema = Joi.object({
  // App
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),

  // Kafka
  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_CLIENT_ID: Joi.string().default('terroir-ma'),

  // Keycloak
  KEYCLOAK_URL: Joi.string().uri().required(),
  KEYCLOAK_REALM: Joi.string().required(),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),
  KEYCLOAK_JWKS_URI: Joi.string().uri().required(),

  // QR HMAC
  QR_HMAC_SECRET: Joi.string().min(32).required(),

  // MinIO
  MINIO_ENDPOINT: Joi.string().required(),
  MINIO_PORT: Joi.number().default(9000),
  MINIO_ACCESS_KEY: Joi.string().required(),
  MINIO_SECRET_KEY: Joi.string().required(),
  MINIO_BUCKET: Joi.string().default('terroir-uploads'),
  MINIO_USE_SSL: Joi.boolean().default(false),

  // SMTP (optional — Mailpit in dev)
  SMTP_HOST: Joi.string().default('localhost'),
  SMTP_PORT: Joi.number().default(1025),
  SMTP_FROM: Joi.string()
    .email({ tlds: { allow: false } })
    .default('noreply@terroir.ma'),

  // Logging
  LOG_LEVEL: Joi.string().valid('trace', 'debug', 'info', 'warn', 'error').default('info'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),

  // Rate limiting
  RATE_LIMIT_TTL: Joi.number().default(900000),
  RATE_LIMIT_LIMIT: Joi.number().default(100),

  // Redpanda Admin (optional)
  REDPANDA_ADMIN_URL: Joi.string().uri().optional(),
}).options({ allowUnknown: true });

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const { error, value } = envValidationSchema.validate(config, { abortEarly: false });
  if (error) {
    throw new Error(
      `ENV validation failed:\n${error.details.map((d) => `  • ${d.message}`).join('\n')}`,
    );
  }
  return value as Record<string, unknown>;
}
