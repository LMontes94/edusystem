import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUES } from './queue.constants';
import { NotificationProcessor } from './processors/notification.processor';
import { AuditProcessor } from './processors/audit.processor';
import { GradeProcessor } from './processors/grade.processor';
import { FcmService } from '../modules/notifications/fcm.service';

// ──────────────────────────────────────────────
// WorkersModule — registra todos los processors.
// Solo se importa en modo APP_MODE=worker.
// En modo API los processors no se cargan.
// ──────────────────────────────────────────────

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.NOTIFICATIONS },
      { name: QUEUES.AUDIT },
      { name: QUEUES.GRADES },
    ),
  ],
  providers: [
    NotificationProcessor,
    AuditProcessor,
    GradeProcessor,
    FcmService,
  ],
})
export class WorkersModule {}
