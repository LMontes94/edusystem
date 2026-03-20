import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QUEUES } from './queue.constants';
import { EnvConfig } from '../config/env.schema';

// ──────────────────────────────────────────────
// QueuesModule — registra y exporta todas las colas.
// @Global() para que los producers estén disponibles
// en cualquier módulo sin necesidad de importarlo.
// ──────────────────────────────────────────────

const bullQueues = Object.values(QUEUES).map((name) =>
  BullModule.registerQueue({ name }),
);

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => ({
        redis: {
          host:     config.get('REDIS_HOST'),
          port:     config.get('REDIS_PORT'),
          password: config.get('REDIS_PASSWORD') || undefined,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      }),
    }),
    ...bullQueues,
  ],
  exports: [...bullQueues],
})
export class QueuesModule {}
