import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EducationLevelsController } from './education-levels.controller';
import { EducationLevelsService } from './education-levels.service';

@Module({
  imports: [PrismaModule],
  controllers: [EducationLevelsController],
  providers: [EducationLevelsService],
  exports: [EducationLevelsService],
})
export class EducationLevelsModule {}
