// src/modules/pending-subjects/pending-subjects.module.ts
import { Module } from '@nestjs/common';
import { PendingSubjectsService } from './pending-subjects.service';

@Module({
  providers:   [PendingSubjectsService],
  exports:     [PendingSubjectsService],
})
export class PendingSubjectsModule {}
