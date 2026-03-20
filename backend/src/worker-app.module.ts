import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';
import { WorkersModule } from './queues/workers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

// ──────────────────────────────────────────────
// WorkerAppModule — módulo mínimo para modo worker.
// Solo carga lo necesario para procesar jobs:
// Config, Prisma, Colas y Processors.
// NO carga controllers, guards ni middleware HTTP.
// ──────────────────────────────────────────────

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    QueuesModule,
    WorkersModule,
    NotificationsModule,
  ],
})
export class WorkerAppModule {}
