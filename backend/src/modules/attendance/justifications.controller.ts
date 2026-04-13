// src/modules/attendance/justifications.controller.ts
import {
  Body, Controller, Delete, Get, Param,
  Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JustificationsService } from './justifications.service';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';

@ApiTags('Justifications')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('justifications')
export class JustificationsController {
  constructor(private readonly justificationsService: JustificationsService) {}

  // ── Justificar inasistencia ───────────────────
  @Post()
  @CheckAbility({ action: Action.Update, subject: 'Attendance' })
  @ApiOperation({ summary: 'Justificar una inasistencia' })
  justify(
    @Body() body: {
      attendanceId: string;
      reason:       string;
      fileUrl?:     string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.justificationsService.justify(body, user);
  }

  // ── Listar justificaciones de un alumno ───────
  @Get('student/:studentId')
  @CheckAbility({ action: Action.Read, subject: 'Attendance' })
  findByStudent(
    @Param('studentId')  studentId:     string,
    @InstitutionId()     institutionId: string,
  ) {
    return this.justificationsService.findByStudent(studentId, institutionId);
  }

  // ── Eliminar justificación ────────────────────
  @Delete(':id')
  @CheckAbility({ action: Action.Update, subject: 'Attendance' })
  remove(
    @Param('id')     id:   string,
    @CurrentUser()   user: RequestUser,
  ) {
    return this.justificationsService.remove(id, user);
  }

  // ── ACTAS ─────────────────────────────────────

  @Get('records')
  @CheckAbility({ action: Action.Read, subject: 'Attendance' })
  @ApiOperation({ summary: 'Listar actas de inasistencia' })
  findRecords(
    @InstitutionId()    institutionId: string,
    @Query('courseId')  courseId?:     string,
    @Query('studentId') studentId?:    string,
  ) {
    return this.justificationsService.findRecords(institutionId, { courseId, studentId });
  }

  // ── Configurar umbrales ───────────────────────
  @Post('thresholds')
  @CheckAbility({ action: Action.Update, subject: 'Institution' })
  @ApiOperation({ summary: 'Configurar umbrales de inasistencia' })
  updateThresholds(
    @Body()          body:          { thresholds: number[] },
    @InstitutionId() institutionId: string,
  ) {
    return this.justificationsService.updateThresholds(institutionId, body.thresholds);
  }
}