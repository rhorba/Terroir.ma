import { registerAs } from '@nestjs/config';

export default registerAs('keycloak', () => ({
  url: process.env.KEYCLOAK_URL ?? 'http://localhost:8443',
  realm: process.env.KEYCLOAK_REALM ?? 'terroir-ma',
  clientId: process.env.KEYCLOAK_CLIENT_ID ?? 'api-client',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',
  jwksUri: `${process.env.KEYCLOAK_URL ?? 'http://localhost:8443'}/realms/${process.env.KEYCLOAK_REALM ?? 'terroir-ma'}/protocol/openid-connect/certs`,
}));
