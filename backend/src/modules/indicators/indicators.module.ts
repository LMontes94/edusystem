import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';
import { QUEUES } from '../../queues/queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.AUDIT }),
  ],
  controllers: [IndicatorsController],
  providers:   [IndicatorsService],
  exports:     [IndicatorsService],
})
export class IndicatorsModule {}