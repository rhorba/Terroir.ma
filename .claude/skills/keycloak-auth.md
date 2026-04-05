---
name: keycloak-auth
description: Keycloak authentication integration for Terroir.ma. JWT validation with passport-jwt and jwks-rsa, role-based guards with @Roles decorator, extracting user context from JWT, OIDC flows for web/mobile/consumer apps, testing with mocked tokens.
---

# Keycloak Authentication — Terroir.ma

## JWT Validation Setup
```typescript
// src/common/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

## @Roles Decorator
```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Usage in controller:
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('cooperative-admin', 'super-admin')
@Post('cooperatives')
async createCooperative(@Body() dto: CreateCooperativeDto) { ... }
```

## @CurrentUser Decorator
```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Set by JwtStrategy
  },
);

// JWT payload shape from Keycloak:
interface JwtPayload {
  sub: string;            // User UUID
  preferred_username: string;
  email: string;
  realm_access: { roles: string[] };
  cooperative_id?: string; // Custom Keycloak attribute
}
```

## Role Hierarchy
- super-admin > cooperative-admin > cooperative-member (cooperative scope)
- certification-body > inspector > lab-technician (certification scope)
- customs-agent (export scope)
- consumer (public verification scope)
- service-account (machine-to-machine)

## OIDC Client Flows
- **web-portal** (cooperatives, labs, certification bodies): Authorization Code + PKCE → redirect localhost:4200
- **inspector-app** (field mobile): Authorization Code + PKCE → terroir://callback
- **consumer-app** (QR scanner): Authorization Code + PKCE → terroir-verify://callback
- **api-client** (backend token validation): Client Credentials
- **admin-console** (platform admin): Authorization Code → localhost:4201

## Testing with Mocked JWT
```typescript
// test/e2e/helpers/auth.helper.ts
async function getTokenForRole(role: string): Promise<string> {
  // In test environment, get real token from Keycloak test realm
  const response = await fetch(`${process.env.KEYCLOAK_URL}/realms/terroir-ma/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'api-client',
      client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
    }),
  });
  return (await response.json()).access_token;
}
```

## Realm Configuration
- Realm: `terroir-ma`
- Login with email, verify email on registration
- Password policy: 8+ chars, 1 uppercase, 1 number, 1 special
- Brute force: max 5 failures, 5-minute lockout
- Internationalization: ar (Arabic), fr (French), zgh (Amazigh)
- Custom theme: `terroir` (Morocco flag colors)
