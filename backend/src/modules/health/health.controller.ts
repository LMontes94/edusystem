import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // ──────────────────────────────────────────────
  // GET /api/v1/health
  // Usado por docker-compose healthcheck y
  // load balancers para verificar que la app está viva.
  // Es @Public(): no requiere JWT.
  // ──────────────────────────────────────────────
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifica el estado de la API y sus dependencias' })
  async check() {
    return this.healthService.check();
  }
}
