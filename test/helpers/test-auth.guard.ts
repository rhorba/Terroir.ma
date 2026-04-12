import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Test JWT guard — decodes unsigned mock tokens used in E2E tests.
 * Replaces JwtAuthGuard in the test app context.
 * Tokens built with buildMockJwt() have the format: header.payload. (empty sig).
 */
@Injectable()
export class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: unknown;
    }>();

    const authHeader = request.headers['authorization'] ?? request.headers['Authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Invalid or missing authentication token');
    }

    const token = authHeader.slice(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid or missing authentication token');
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as unknown;
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or missing authentication token');
    }
  }
}
