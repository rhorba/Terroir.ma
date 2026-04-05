export const pinoConfig = {
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: ['req.headers.authorization', 'body.cin', 'body.phone', 'body.email'],
    censor: '[REDACTED-PII]',
  },
};
