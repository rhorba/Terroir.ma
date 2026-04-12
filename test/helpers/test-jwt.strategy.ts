import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';

/**
 * Test JWT strategy — decodes unsigned mock JWTs (alg: none) used in E2E tests.
 * Registered under the name 'jwt' so it replaces the real Keycloak strategy.
 * Tokens built with buildMockJwt() have the format: header.b64payload. (empty sig).
 */
@Injectable()
export class TestJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  authenticate(req: { headers: Record<string, string | string[] | undefined> }): void {
    const rawHeader = req.headers['authorization'] ?? req.headers['Authorization'];
    const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!authHeader?.startsWith('Bearer ')) {
      return this.fail({ message: 'No token' }, 401);
    }

    const token = authHeader.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return this.fail({ message: 'Invalid token' }, 401);
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as unknown;
      return this.success(payload);
    } catch {
      return this.fail({ message: 'Invalid token payload' }, 401);
    }
  }
}
