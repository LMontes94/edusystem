import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { EnvConfig } from '../../config/env.schema';
import { LoginDto, AuthResponse } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async login(dto: LoginDto, deviceInfo?: object): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Tu cuenta está inactiva o suspendida');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.institutionId,
      user.role,
      user.email,
    );

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId:     user.id,
        tokenHash,
        deviceInfo: deviceInfo ?? {},
        expiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date() },
    });

    this.logger.log(`Login exitoso: ${user.email} (${user.role}) [${user.status}]`);

    return {
      accessToken,
      refreshToken,
      user: {
        id:             user.id,
        email:          user.email,
        firstName:      user.firstName,
        lastName:       user.lastName,
        role:           user.role,
        institutionId:  user.institutionId,
        status:         user.status,          
        leaveStartDate: user.leaveStartDate?.toISOString() ?? null, 
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId:    payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let validToken: (typeof tokens)[0] | null = null;
    for (const token of tokens) {
      const matches = await bcrypt.compare(refreshToken, token.tokenHash);
      if (matches) { validToken = token; break; }
    }

    if (!validToken) {
      throw new UnauthorizedException('Refresh token inválido o ya utilizado');
    }

    const { accessToken } = await this.generateTokens(
      payload.sub,
      payload.institutionId,
      payload.role,
      payload.email,
    );

    return { accessToken };
  }

  async logout(refreshToken: string): Promise<void> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.decode<JwtPayload>(refreshToken);
    } catch {
      return;
    }

    if (!payload?.sub) return;

    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: payload.sub, revokedAt: null },
    });

    for (const token of tokens) {
      const matches = await bcrypt.compare(refreshToken, token.tokenHash);
      if (matches) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data:  { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  private async generateTokens(
    userId:        string,
    institutionId: string | null,
    role:          string,
    email:         string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: userId, institutionId, role, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret:    this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret:    this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}