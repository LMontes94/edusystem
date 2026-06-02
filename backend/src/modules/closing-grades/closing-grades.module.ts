import { Module } from '@nestjs/common';
import { ClosingGradesController } from './closing-grades.controller';
import { ClosingGradesService } from './closing-grades.service';

@Module({
  controllers: [ClosingGradesController],
  providers:   [ClosingGradesService],
  exports:     [ClosingGradesService],
})
export class ClosingGradesModule {}
