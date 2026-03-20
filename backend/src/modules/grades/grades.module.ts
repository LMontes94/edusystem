import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';
import { QUEUES } from '../../queues/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.NOTIFICATIONS },
      { name: QUEUES.AUDIT },
      { name: QUEUES.GRADES },
    ),
  ],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
