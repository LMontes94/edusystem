import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import {
  CreateSchoolYearDto, CreateSchoolYearSchema,
  CreateCourseDto, CreateCourseSchema,
  UpdateCourseDto, UpdateCourseSchema,
  AssignTeacherDto, AssignTeacherSchema,
  CreatePeriodDto, CreatePeriodSchema,
} from './dto/course.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Courses')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // ── School Years ─────────────────────────────
  @Get('school-years')
  @CheckAbility({ action: Action.Read, subject: 'Course' })
  @ApiOperation({ summary: 'Listar años lectivos' })
  findAllSchoolYears(@InstitutionId() institutionId: string) {
    return this.coursesService.findAllSchoolYears(institutionId);
  }

  @Post('school-years')
  @CheckAbility({ action: Action.Create, subject: 'Course' })
  @ApiOperation({ summary: 'Crear año lectivo' })
  createSchoolYear(
    @Body(new ZodPipe(CreateSchoolYearSchema)) dto: CreateSchoolYearDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.coursesService.createSchoolYear(dto, institutionId);
  }

  @Patch('school-years/:id/activate')
  @CheckAbility({ action: Action.Update, subject: 'Course' })
  @ApiOperation({ summary: 'Activar año lectivo' })
  activateSchoolYear(
    @Param('id') id: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.coursesService.setActiveSchoolYear(id, institutionId);
  }

  // ── Periods ───────────────────────────────────
  @Get('school-years/:id/periods')
  @CheckAbility({ action: Action.Read, subject: 'Course' })
  @ApiOperation({ summary: 'Listar períodos de un año lectivo' })
  findPeriods(
    @Param('id') schoolYearId: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.coursesService.findPeriods(schoolYearId, institutionId);
  }

  @Post('periods')
  @CheckAbility({ action: Action.Create, subject: 'Course' })
  @ApiOperation({ summary: 'Crear período' })
  createPeriod(
    @Body(new ZodPipe(CreatePeriodSchema)) dto: CreatePeriodDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.coursesService.createPeriod(dto, institutionId);
  }

  // ── Courses ───────────────────────────────────
  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Course' })
  @ApiOperation({ summary: 'Listar cursos' })
  @ApiQuery({ name: 'schoolYearId', required: false })
  findAll(
    @InstitutionId() institutionId: string,
    @Query('schoolYearId') schoolYearId?: string,
  ) {
    return this.coursesService.findAll(institutionId, schoolYearId);
  }

  @Get('my-courses')
  @CheckAbility({ action: Action.Read, subject: 'Course' })
  @ApiOperation({ summary: 'Cursos del docente autenticado' })
  findMyCourses(@CurrentUser() user: RequestUser) {
    return this.coursesService.findByTeacher(user.id, user.institutionId!);
  }
  
  @Get('my-subjects')
    @CheckAbility({ action: Action.Read, subject: 'Course' })
    @ApiOperation({ summary: 'Materias asignadas al docente autenticado' })
    getMySubjects(
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.coursesService.getTeacherSubjects(user.id, institutionId);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Course' })
  @ApiOperation({ summary: 'Obtener detalle de un curso' })
  findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.coursesService.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Course' })
  @ApiOperation({ summary: 'Crear curso' })
  create(
    @Body(new ZodPipe(CreateCourseSchema)) dto: CreateCourseDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.coursesService.create(dto, institutionId);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Course' })
  @ApiOperation({ summary: 'Actualizar curso' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateCourseSchema)) dto: UpdateCourseDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.coursesService.update(id, dto, institutionId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'Course' })
  @ApiOperation({ summary: 'Eliminar curso' })
  remove(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.coursesService.remove(id, institutionId);
  }

  @Post(':id/subjects')
  @CheckAbility({ action: Action.Update, subject: 'Course' })
  @ApiOperation({ summary: 'Asignar docente a materia en un curso' })
  assignTeacher(
    @Param('id') courseId: string,
    @Body(new ZodPipe(AssignTeacherSchema)) dto: AssignTeacherDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.coursesService.assignTeacher(courseId, dto, institutionId);
  }

}
