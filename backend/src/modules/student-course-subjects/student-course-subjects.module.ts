import { Module } from '@nestjs/common';
import { StudentCourseSubjectsService }    from './student-course-subjects.service';
import { StudentCourseSubjectsController } from './student-course-subjects.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [StudentCourseSubjectsController],
  providers:   [StudentCourseSubjectsService],
  exports:     [StudentCourseSubjectsService], // exportado para grades y attendance
})
export class StudentCourseSubjectsModule {}