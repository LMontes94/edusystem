import { Module } from '@nestjs/common';
import { ClosingGradesController } from './closing-grades.controller';
import { ClosingGradesService } from './closing-grades.service';
import { PromotionModule } from '../promotion/promotion.module';

@Module({
  controllers: [ClosingGradesController],
  providers:   [ClosingGradesService],
  exports:     [ClosingGradesService],
  imports:     [PromotionModule],
})
export class ClosingGradesModule {}
