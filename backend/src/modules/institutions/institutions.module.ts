import { Module } from '@nestjs/common';
import { InstitutionsController } from './institutions.controller';
import { InstitutionsService } from './institutions.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  controllers: [InstitutionsController],
  providers: [InstitutionsService],
  exports: [InstitutionsService],
  imports:  [StorageModule],
})
export class InstitutionsModule {}
