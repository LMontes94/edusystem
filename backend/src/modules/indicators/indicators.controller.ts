// src/modules/indicators/indicators.controller.ts
import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IndicatorsService } from './indicators.service';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Indicators')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}

  // ── Listar indicadores ────────────────────────
  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Listar indicadores por materia y año lectivo' })
  findAll(
    @Query('subjectId')    subjectId:    string,
    @Query('schoolYearId') schoolYearId: string,
    @Query('grade')        grade:        string,
  ) {
    return this.indicatorsService.findAll(subjectId, schoolYearId,Number(grade));
  }

  // ── Crear indicador ───────────────────────────
  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Grade' })
  @ApiOperation({ summary: 'Crear indicador (solo ADMIN/DIRECTOR)' })
  create(
    @Body() body: {
      subjectId:    string;
      schoolYearId: string;
      grade:        number;
      description:  string;
      order?:       number;
    },
  ) {
    return this.indicatorsService.create(body);
  }

  // ── Actualizar indicador ──────────────────────
  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Grade' })
  update(@Param('id') id: string, @Body() body: { description: string }) {
    return this.indicatorsService.update(id, body.description);
  }

  // ── Reordenar ─────────────────────────────────
  @Post('reorder')
  @CheckAbility({ action: Action.Update, subject: 'Grade' })
  reorder(@Body() body: { ids: string[] }) {
    return this.indicatorsService.reorder(body.ids);
  }

  // ── Eliminar ──────────────────────────────────
  @Delete(':id')
  @CheckAbility({ action: Action.Delete, subject: 'Grade' })
  remove(@Param('id') id: string) {
    return this.indicatorsService.remove(id);
  }

  // ── Evaluaciones de un curso ──────────────────
  @Get('course/:courseId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Obtener grilla de evaluaciones de un curso' })
  getCourseEvaluations(
    @Param('courseId')     courseId:     string,
    @Query('subjectId')    subjectId:    string,
    @Query('schoolYearId') schoolYearId: string,
    @Query('periodId')     periodId:     string,
  ) {
    return this.indicatorsService.getCourseEvaluations(
      courseId, subjectId, schoolYearId, periodId,
    );
  }

  // ── Evaluaciones de un alumno ─────────────────
  @Get('student/:studentId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  getStudentEvaluations(
    @Param('studentId')    studentId:    string,
    @Query('schoolYearId') schoolYearId: string,
  ) {
    return this.indicatorsService.getStudentEvaluations(studentId, schoolYearId);
  }

  // ── Guardar evaluaciones masivas ──────────────
  @Post('evaluations/bulk')
  @CheckAbility({ action: Action.Create, subject: 'Grade' })
  @ApiOperation({ summary: 'Guardar evaluaciones de indicadores para un curso' })
  bulkUpsertEvaluations(
    @Body() body: {
      evaluations: {
        indicatorId: string;
        studentId:   string;
        periodId:    string;
        value:       string;
      }[];
    },
  ) {
    return this.indicatorsService.bulkUpsertEvaluations(body.evaluations);
  }

  @Post('observations')
@CheckAbility({ action: Action.Create, subject: 'Grade' })
@ApiOperation({ summary: 'Guardar observación de un alumno' })
upsertObservation(
  @Body() body: {
    studentId:   string;
    periodId:    string;
    courseId:    string;
    observation: string;
  },
  @CurrentUser() user: RequestUser,
) {
  return this.indicatorsService.upsertObservation({
    ...body,
    authorId: user.id,
  });
}

@Get('observations/:courseId')
@CheckAbility({ action: Action.Read, subject: 'Grade' })
@ApiOperation({ summary: 'Obtener observaciones de un curso por período' })
getCourseObservations(
  @Param('courseId') courseId: string,
  @Query('periodId') periodId: string,
) {
  return this.indicatorsService.getCourseObservations(courseId, periodId);
}
}