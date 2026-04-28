import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  preferred_username: string;
  email?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  cooperative_id?: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const jwksUri =
      configService.get<string>('keycloak.jwksUri') ??
      'http://keycloak:8080/realms/terroir-ma/protocol/openid-connect/certs';

    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // No issuer check — external and internal Keycloak URLs differ in Docker dev
    });
  }

  validate(payload: JwtPayload): Record<string, unknown> {
    return {
      sub: payload.sub,
      preferred_username: payload.preferred_username,
      email: payload.email,
      realm_access: payload.realm_access ?? { roles: [] },
      resource_access: payload.resource_access ?? {},
      cooperative_id: payload.cooperative_id,
    };
  }
}
