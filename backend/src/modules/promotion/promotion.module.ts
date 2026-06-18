import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUES } from '../../queues/queue.constants';
import { PromotionController } from './promotion.controller';
import { PromotionEngine } from './engine/promotion-engine';
import { PromotionPreviewService } from './services/promotion-preview.service';
import { PromotionExecutionService } from './services/promotion-execution.service';
import { PromotionOverrideService } from './services/promotion-override.service';
import { PromotionReportingService } from './services/promotion-reporting.service';
import { EffectiveResultViewService } from './utils/effective-result.view';
import { DestinationResolver } from './utils/destination-resolver';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.AUDIT },
    ),
  ],
  controllers: [PromotionController],
  providers: [
    PromotionEngine,
    PromotionPreviewService,
    PromotionExecutionService,
    PromotionOverrideService,
    PromotionReportingService,
    EffectiveResultViewService,
    DestinationResolver,
  ],
  exports: [
    PromotionEngine,
    PromotionPreviewService,
    PromotionExecutionService,
    PromotionOverrideService,
    PromotionReportingService,
    EffectiveResultViewService,
    DestinationResolver,
  ],
})
export class PromotionModule {}
