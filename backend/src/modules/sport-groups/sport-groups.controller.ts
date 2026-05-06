import {
  Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SportGroupsService } from './sport-groups.service';
import {
  CreateSportGroupDto, CreateSportGroupSchema,
  UpdateSportGroupDto, UpdateSportGroupSchema,
  AddStudentsDto, AddStudentsSchema,
  SportGroupQueryDto, SportGroupQuerySchema,
  BulkSportAttendanceDto, BulkSportAttendanceSchema,
  SportAttendanceQueryDto, SportAttendanceQuerySchema,
} from './dto/sport-group.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId }            from '../../common/decorators/institution-id.decorator';
import { ZodPipe }                  from '../../common/pipes/zod.pipe';
import { CaslGuard }                from '../casl/guards/casl.guard';
import { CheckAbility }             from '../casl/decorators/check-ability.decorator';
import { Action }                   from '../casl/casl.types';

@ApiTags('Sport Groups')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('sport-groups')
export class SportGroupsController {
  constructor(private readonly service: SportGroupsService) {}

  // ─── Grupos ───────────────────────────────────────────────────────────────

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'SportGroup' })
  @ApiOperation({ summary: 'Listar grupos de deporte (TEACHER ve solo los suyos)' })
  findAll(
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(SportGroupQuerySchema)) query: SportGroupQueryDto,
  ) {
    return this.service.findAll(institutionId, user, query);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'SportGroup' })
  @ApiOperation({ summary: 'Obtener un grupo de deporte' })
  findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.service.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'SportGroup' })
  @ApiOperation({ summary: 'Crear grupo de deporte (ADMIN/DIRECTOR/SECRETARY)' })
  create(
    @Body(new ZodPipe(CreateSportGroupSchema)) dto: CreateSportGroupDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.service.create(institutionId, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'SportGroup' })
  @ApiOperation({ summary: 'Actualizar grupo (nombre, docentes, alumnos)' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateSportGroupSchema)) dto: UpdateSportGroupDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.service.update(id, institutionId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'SportGroup' })
  @ApiOperation({ summary: 'Eliminar grupo de deporte' })
  remove(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.service.remove(id, institutionId);
  }

  // ─── Gestión de alumnos ───────────────────────────────────────────────────

  @Post(':id/students')
  @CheckAbility({ action: Action.Update, subject: 'SportGroup' })
  @ApiOperation({ summary: 'Agregar alumnos al grupo' })
  addStudents(
    @Param('id') id: string,
    @Body(new ZodPipe(AddStudentsSchema)) dto: AddStudentsDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.service.addStudents(id, institutionId, dto);
  }

  @Delete(':id/students/:studentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Update, subject: 'SportGroup' })
  @ApiOperation({ summary: 'Quitar alumno del grupo' })
  removeStudent(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.service.removeStudent(id, institutionId, studentId);
  }

  // ─── Asistencia de deportes ───────────────────────────────────────────────

  @Get('attendance')
  @CheckAbility({ action: Action.Read, subject: 'Attendance' })
  @ApiOperation({ summary: 'Listar asistencias de deportes' })
  getAttendance(
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(SportAttendanceQuerySchema)) query: SportAttendanceQueryDto,
  ) {
    return this.service.getAttendance(institutionId, user, query);
  }

  @Post('attendance/bulk')
  @CheckAbility({ action: Action.Create, subject: 'Attendance' })
  @ApiOperation({ summary: 'Tomar lista de un grupo de deporte (carga masiva)' })
  bulkAttendance(
    @Body(new ZodPipe(BulkSportAttendanceSchema)) dto: BulkSportAttendanceDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.service.bulkAttendance(dto, user, institutionId);
  }
}