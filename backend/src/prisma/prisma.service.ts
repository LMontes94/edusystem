import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// ──────────────────────────────────────────────
// PrismaService — singleton global del cliente DB.
//
// Incluye:
//   • Conexión/desconexión limpia en lifecycle hooks
//   • Middleware de soft-delete: filtra automáticamente
//     registros con deletedAt != null en findMany/findFirst
//   • Log de queries lentas en desarrollo (>500ms)
// ──────────────────────────────────────────────

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado a PostgreSQL');

    // Log de queries lentas (solo desarrollo)
    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error: evento de query de Prisma
      this.$on('query', (e: { query: string; duration: number }) => {
        if (e.duration > 500) {
          this.logger.warn(
            `Query lenta (${e.duration}ms): ${e.query.slice(0, 120)}...`,
          );
        }
      });
    }

    // ── Middleware: soft-delete automático ──────
    // Filtra registros con deletedAt != null en todas
    // las operaciones findMany y findFirst.
    // Los servicios nunca necesitan agregar este filtro.
    this.$use(async (params, next) => {
      const modelsWithSoftDelete = [
        'User',
        'Student',
        'Announcement',
        'Institution',
      ];

      if (
        params.model &&
        modelsWithSoftDelete.includes(params.model) &&
        (params.action === 'findMany' || params.action === 'findFirst')
      ) {
        params.args.where = {
          ...params.args.where,
          deletedAt: null,
        };
      }

      return next(params);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Desconectado de PostgreSQL');
  }

  // ── Helpers de transacción ───────────────────
  // Wrapper tipado para usar en servicios con
  // múltiples operaciones atómicas.
  async runTransaction<T>(
    fn: (prisma: PrismaService) => Promise<T>,
  ): Promise<T> {
    return this.$transaction((tx) => fn(tx as unknown as PrismaService));
  }
}
