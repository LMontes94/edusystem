import {
  Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StudentCourseSubjectsService } from './student-course-subjects.service';
import {
  AssignSubjectDto, AssignSubjectSchema,
  UpdateSubjectAssignmentDto, UpdateSubjectAssignmentSchema,
  StudentSubjectQueryDto, StudentSubjectQuerySchema,
} from './dto/student-course-subject.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId }            from '../../common/decorators/institution-id.decorator';
import { ZodPipe }                  from '../../common/pipes/zod.pipe';
import { CaslGuard }                from '../casl/guards/casl.guard';
import { CheckAbility }             from '../casl/decorators/check-ability.decorator';
import { Action }                   from '../casl/casl.types';

@ApiTags('Student Course Subjects')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('students/:studentId/subjects')
export class StudentCourseSubjectsController {
  constructor(private readonly service: StudentCourseSubjectsService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Student' })
  @ApiOperation({ summary: 'Listar materias del alumno (regulares + recursadas + eximidas)' })
  findByStudent(
    @Param('studentId') studentId: string,
    @InstitutionId() institutionId: string,
    @Query(new ZodPipe(StudentSubjectQuerySchema)) query: StudentSubjectQueryDto,
  ) {
    return this.service.findByStudent(studentId, institutionId, query);
  }

  @Post()
  @CheckAbility({ action: Action.Update, subject: 'Student' })
  @ApiOperation({ summary: 'Asignar materia recursada o eximida (ADMIN/DIRECTOR)' })
  assign(
    @Param('studentId') studentId: string,
    @Body(new ZodPipe(AssignSubjectSchema)) dto: AssignSubjectDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.assign(studentId, institutionId, dto, user);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Student' })
  @ApiOperation({ summary: 'Cambiar tipo de asignación (RECURSE ↔ EXEMPT)' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateSubjectAssignmentSchema)) dto: UpdateSubjectAssignmentDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Update, subject: 'Student' })
  @ApiOperation({ summary: 'Eliminar asignación individual' })
  remove(
    @Param('id') id: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.service.remove(id, institutionId);
  }
}