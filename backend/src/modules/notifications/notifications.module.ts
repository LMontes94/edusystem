import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FcmService } from './fcm.service';
import { NotificationQueueService }   from './notification-queue.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, FcmService, NotificationQueueService],
  exports: [NotificationsService, FcmService, NotificationQueueService],
})
export class NotificationsModule {}
