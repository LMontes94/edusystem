import { Module } from '@nestjs/common';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';
import { StorageModule } from '../storage/storage.module';
import { EducationLevelsModule } from '../education-levels/education-levels.module';

@Module({
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
  imports:  [StorageModule, EducationLevelsModule],
})
export class InstitutionsModule {}
