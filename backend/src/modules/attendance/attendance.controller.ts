import {
  Body, Controller, Get, Param,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  CreateAttendanceDto, CreateAttendanceSchema,
  BulkAttendanceDto, BulkAttendanceSchema,
  UpdateAttendanceDto, UpdateAttendanceSchema,
  AttendanceQueryDto, AttendanceQuerySchema,
} from './dto/attendance.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Attendance')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Attendance' })
  @ApiOperation({ summary: 'Listar asistencias (filtrado por rol automáticamente)' })
  findAll(
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(AttendanceQuerySchema)) query: AttendanceQueryDto,
  ) {
    return this.attendanceService.findAll(institutionId, user, query);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Attendance' })
  @ApiOperation({ summary: 'Registrar asistencia individual' })
  create(
    @Body(new ZodPipe(CreateAttendanceSchema)) dto: CreateAttendanceDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.attendanceService.create(dto, user, institutionId);
  }

  @Post('bulk')
  @CheckAbility({ action: Action.Create, subject: 'Attendance' })
  @ApiOperation({ summary: 'Tomar lista completa de un curso (carga masiva)' })
  bulkCreate(
    @Body(new ZodPipe(BulkAttendanceSchema)) dto: BulkAttendanceDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.attendanceService.bulkCreate(dto, user, institutionId);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Attendance' })
  @ApiOperation({ summary: 'Actualizar registro de asistencia' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateAttendanceSchema)) dto: UpdateAttendanceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.attendanceService.update(id, dto, user);
  }

  @Get('student/:studentId/summary')
  @CheckAbility({ action: Action.Read, subject: 'Attendance' })
  @ApiOperation({ summary: 'Resumen de asistencia de un alumno' })
  getSummary(
    @Param('studentId') studentId: string,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.attendanceService.getSummary(studentId, user, institutionId);
  }
}
