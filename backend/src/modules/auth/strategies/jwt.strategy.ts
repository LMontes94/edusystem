import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { EnvConfig } from '../../../config/env.schema';
import { RequestUser } from '../../../common/decorators/current-user.decorator';

// ──────────────────────────────────────────────
// JwtStrategy — verifica la firma del token JWT
// en cada request protegido.
//
// Extrae el payload y carga el usuario desde DB
// para garantizar que sigue activo y no fue suspendido.
// El resultado se inyecta en req.user
// y queda disponible via @CurrentUser().
// ──────────────────────────────────────────────

export interface JwtPayload {
  sub: string;           // userId
  institutionId: string | null;
  role: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        institutionId: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Usuario inactivo o suspendido');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
    };
  }
}
