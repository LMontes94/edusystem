import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { JustificationsService }    from './justifications.service';
import { JustificationsController } from './justifications.controller'

@Module({
  controllers: [AttendanceController, JustificationsController],
  providers:   [AttendanceService,    JustificationsService],
  exports:     [AttendanceService,    JustificationsService],
})
export class AttendanceModule {}
