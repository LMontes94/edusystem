import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { createClient } from 'redis';
import { EnvConfig } from '../../config/env.schema';

// ──────────────────────────────────────────────
// Tipos de respuesta del health check
// ──────────────────────────────────────────────
type ServiceStatus = 'up' | 'down';

export interface HealthResult {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  async check(): Promise<HealthResult> {
    const [dbStatus, redisStatus] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allUp = dbStatus === 'up' && redisStatus === 'up';

    return {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? '0.0.1',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };
  }

  // ── Checks individuales ──────────────────────

  private async checkDatabase(): Promise<ServiceStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (err) {
      this.logger.error('DB health check falló', err);
      return 'down';
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    let client: ReturnType<typeof createClient> | null = null;
    try {
      client = createClient({
        socket: {
          host: this.config.get('REDIS_HOST'),
          port: this.config.get('REDIS_PORT'),
          connectTimeout: 2000,
        },
        password: this.config.get('REDIS_PASSWORD') || undefined,
      });

      await client.connect();
      const pong = await client.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch (err) {
      this.logger.error('Redis health check falló', err);
      return 'down';
    } finally {
      if (client) await client.disconnect().catch(() => null);
    }
  }
}
