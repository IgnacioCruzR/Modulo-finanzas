import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: number | string;
  username: string;
  email: string;
  role: 'ADMIN' | 'CAJERO';
}

function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET')
    ?? (config.get('APP_ENV') === 'production' ? undefined : 'desarrollo-finanzas-cambiar');
  if (!secret) throw new Error('JWT_SECRET es obligatorio fuera del entorno local.');
  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    });
  }

  validate(payload: JwtPayload) {
    if (!payload?.sub || !payload.role || !payload.username) {
      throw new UnauthorizedException('Token inválido.');
    }
    return {
      id: Number(payload.sub),
      sub: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
    };
  }
}
