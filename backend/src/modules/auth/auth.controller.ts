import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LoginSchema,
  RefreshTokenDto,
  RefreshTokenSchema,
} from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/login ────────────────────────
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión y obtener tokens JWT' })
  async login(
    @Body(new ZodPipe(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
  ) {
    const deviceInfo = {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };
    return this.authService.login(dto, deviceInfo);
  }

  // ── POST /auth/refresh ──────────────────────
  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener nuevo accessToken con el refreshToken' })
  async refresh(
    @Body(new ZodPipe(RefreshTokenSchema)) dto: RefreshTokenDto,
  ) {
    return this.authService.refresh(dto.refreshToken);
  }

  // ── POST /auth/logout ───────────────────────
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Cerrar sesión y revocar el refreshToken' })
  async logout(
    @Body(new ZodPipe(RefreshTokenSchema)) dto: RefreshTokenDto,
  ) {
    await this.authService.logout(dto.refreshToken);
  }
}
