import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// ──────────────────────────────────────────────
// AuthModule — registra el JwtAuthGuard como
// guard GLOBAL de la aplicación via APP_GUARD.
//
// Esto significa que TODAS las rutas requieren
// JWT por defecto. Para rutas públicas usar @Public().
// ──────────────────────────────────────────────

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,

    // Guard global: protege toda la app automáticamente
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
