import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { EducationLevelsController } from './education-levels.controller';
import { EducationLevelsService } from './education-levels.service';
import { AcademicStructureFactory } from './services/academic-structure.factory';

@Module({
  imports: [PrismaModule],
  controllers: [EducationLevelsController],
  providers: [EducationLevelsService, AcademicStructureFactory],
  exports: [EducationLevelsService, AcademicStructureFactory],
})
export class EducationLevelsModule {}
