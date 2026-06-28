import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { JustificationsService }    from './justifications.service';
import { JustificationsController } from './justifications.controller'
import { NotificationsModule } from '../notifications/notifications.module';
import { PromotionModule } from '../promotion/promotion.module';

@Module({
  controllers: [AttendanceController, JustificationsController],
  providers:   [AttendanceService,    JustificationsService],
  exports:     [AttendanceService,    JustificationsService],
  imports: [NotificationsModule, PromotionModule],
})
export class AttendanceModule {}
