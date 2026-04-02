// src/modules/teacher/teacher.controller.ts
import {
  Body, Controller, Delete, Get, Param,
  Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeacherService } from './teacher.service';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';

@ApiTags('Teacher')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('teacher')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  // ── TEMARIO ───────────────────────────────────

  @Get('syllabus/:courseSubjectId')
  @CheckAbility({ action: Action.Read, subject: 'Course' })
  @ApiOperation({ summary: 'Obtener temario de una materia' })
  getSyllabus(@Param('courseSubjectId') courseSubjectId: string) {
    return this.teacherService.getSyllabus(courseSubjectId);
  }

  @Post('syllabus')
  @CheckAbility({ action: Action.Create, subject: 'Grade' })
  @ApiOperation({ summary: 'Guardar temario de un período' })
  upsertSyllabus(
    @Body() body: {
      courseSubjectId: string;
      periodId:        string;
      title:           string;
      contents:        string;
      bibliography?:   string;
    },
  ) {
    return this.teacherService.upsertSyllabus(body);
  }

  @Delete('syllabus/:id')
  @CheckAbility({ action: Action.Delete, subject: 'Grade' })
  deleteSyllabus(@Param('id') id: string) {
    return this.teacherService.deleteSyllabus(id);
  }

  // ── PENDIENTES ────────────────────────────────

  @Get('pending/:courseId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Obtener materias pendientes de un curso' })
  getPendingSubjects(
    @Param('courseId')     courseId:     string,
    @Query('schoolYearId') schoolYearId: string,
    @InstitutionId()       institutionId: string,
  ) {
    return this.teacherService.getPendingSubjects(courseId, schoolYearId, institutionId);
  }

  @Post('pending')
  @CheckAbility({ action: Action.Create, subject: 'Grade' })
  @ApiOperation({ summary: 'Guardar materia pendiente de un alumno' })
  upsertPendingSubject(
    @Body() body: {
      studentId:      string;
      subjectId:      string;
      schoolYearId:   string;
      initialSabers?: string;
      march?:         string;
      august?:        string;
      november?:      string;
      december?:      string;
      february?:      string;
      finalScore?:    string;
      closingSabers?: string;
    },
    @InstitutionId() institutionId: string,
  ) {
    return this.teacherService.upsertPendingSubject({ ...body, institutionId });
  }

  @Delete('pending/:id')
  @CheckAbility({ action: Action.Delete, subject: 'Grade' })
  deletePendingSubject(@Param('id') id: string) {
    return this.teacherService.deletePendingSubject(id);
  }

  @Get('pending/student/:studentId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  getStudentPendingSubjects(
    @Param('studentId')    studentId:    string,
    @Query('schoolYearId') schoolYearId: string,
  ) {
    return this.teacherService.getStudentPendingSubjects(studentId, schoolYearId);
  }
}