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

// ──────────────────────────────────────────────
// AuthService — lógica de autenticación.
//
// Flujo de login:
//   1. Verificar email + password
//   2. Generar accessToken (15m) + refreshToken (7d)
//   3. Guardar hash del refreshToken en DB
//   4. Devolver tokens + datos del usuario
//
// Flujo de refresh:
//   1. Verificar refreshToken con JWT_REFRESH_SECRET
//   2. Buscar el hash en DB y verificar que no fue revocado
//   3. Generar nuevo accessToken
//
// Flujo de logout:
//   1. Revocar el refreshToken en DB (revokedAt = now)
// ──────────────────────────────────────────────

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  // ── Login ──────────────────────────────────
  async login(dto: LoginDto, deviceInfo?: object): Promise<AuthResponse> {
    // 1. Buscar usuario por email (ignorar soft-delete aquí para dar mensaje genérico)
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tu cuenta está inactiva o suspendida');
    }

    // 2. Verificar contraseña
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Generar tokens
    const { accessToken, refreshToken } = await this.generateTokens(
      user.id,
      user.institutionId,
      user.role,
      user.email,
    );

    // 4. Guardar hash del refresh token en DB
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceInfo: deviceInfo ?? {},
        expiresAt,
      },
    });

    // 5. Actualizar último login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    this.logger.log(`Login exitoso: ${user.email} (${user.role})`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        institutionId: user.institutionId,
      },
    };
  }

  // ── Refresh Token ───────────────────────────
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    // 1. Verificar firma del refresh token
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // 2. Buscar tokens activos del usuario y verificar hash
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    let validToken: (typeof tokens)[0] | null = null;
    for (const token of tokens) {
      const matches = await bcrypt.compare(refreshToken, token.tokenHash);
      if (matches) {
        validToken = token;
        break;
      }
    }

    if (!validToken) {
      throw new UnauthorizedException('Refresh token inválido o ya utilizado');
    }

    // 3. Generar nuevo accessToken
    const { accessToken } = await this.generateTokens(
      payload.sub,
      payload.institutionId,
      payload.role,
      payload.email,
    );

    return { accessToken };
  }

  // ── Logout ──────────────────────────────────
  async logout(refreshToken: string): Promise<void> {
    // Revocar el refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.decode<JwtPayload>(refreshToken);
    } catch {
      return; // Token malformado — no hacer nada
    }

    if (!payload?.sub) return;

    // Buscar y revocar el token que coincida
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId: payload.sub,
        revokedAt: null,
      },
    });

    for (const token of tokens) {
      const matches = await bcrypt.compare(refreshToken, token.tokenHash);
      if (matches) {
        await this.prisma.refreshToken.update({
          where: { id: token.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }

  // ── Helpers ─────────────────────────────────
  private async generateTokens(
    userId: string,
    institutionId: string | null,
    role: string,
    email: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: userId,
      institutionId,
      role,
      email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
