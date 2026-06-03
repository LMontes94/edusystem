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
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { BulkEvaluationSchema } from './dto/indicator.dto';
import { CreateIndicatorSchema } from './dto/create-indicator.dto';
import { UpdateIndicatorSchema } from './dto/update-indicator.dto';
import { ReorderIndicatorsSchema } from './dto/reorder-indicators.dto';
import { UpsertObservationSchema } from './dto/upsert-observation.dto';

@ApiTags('Indicators')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicatorsService: IndicatorsService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Indicator' })
  @ApiOperation({ summary: 'Listar indicadores por materia y año lectivo' })
  findAll(
    @Query('subjectId')    subjectId:    string,
    @Query('schoolYearId') schoolYearId: string,
    @Query('grade')        grade:        string,
    @InstitutionId()       institutionId: string,
  ) {
    return this.indicatorsService.findAll(subjectId, schoolYearId, Number(grade), institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Indicator' })
  @ApiOperation({ summary: 'Crear indicador (solo ADMIN/DIRECTOR)' })
  create(
    @Body(new ZodPipe(CreateIndicatorSchema)) dto: any,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.indicatorsService.create(dto, institutionId, user.id);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Indicator' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateIndicatorSchema)) dto: any,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.indicatorsService.update(id, dto, institutionId, user.id);
  }

  @Post('reorder')
  @CheckAbility({ action: Action.Update, subject: 'Indicator' })
  reorder(
    @Body(new ZodPipe(ReorderIndicatorsSchema)) dto: any,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.indicatorsService.reorder(dto, institutionId, user.id);
  }

  @Delete(':id')
  @CheckAbility({ action: Action.Delete, subject: 'Indicator' })
  remove(
    @Param('id') id: string,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.indicatorsService.remove(id, institutionId, user.id);
  }

  @Get('course/:courseId')
  @CheckAbility({ action: Action.Read, subject: 'Indicator' })
  @ApiOperation({ summary: 'Obtener grilla de evaluaciones de un curso' })
  getCourseEvaluations(
    @Param('courseId')     courseId:     string,
    @Query('subjectId')    subjectId:    string,
    @Query('schoolYearId') schoolYearId: string,
    @Query('periodId')     periodId:     string,
    @InstitutionId()       institutionId: string,
    @CurrentUser()         user: RequestUser,
  ) {
    return this.indicatorsService.getCourseEvaluations(
      courseId, subjectId, schoolYearId, periodId, institutionId, user,
    );
  }

  @Get('student/:studentId')
  @CheckAbility({ action: Action.Read, subject: 'StudentObservation' })
  getStudentEvaluations(
    @Param('studentId')    studentId:    string,
    @Query('schoolYearId') schoolYearId: string,
    @InstitutionId()       institutionId: string,
  ) {
    return this.indicatorsService.getStudentEvaluations(studentId, schoolYearId, institutionId);
  }

  @Post('evaluations/bulk')
  @CheckAbility({ action: Action.Update, subject: 'IndicatorEvaluation' })
  @ApiOperation({ summary: 'Guardar evaluaciones de indicadores para un curso' })
  bulkUpsertEvaluations(
    @Body(new ZodPipe(BulkEvaluationSchema)) body: any,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.indicatorsService.bulkUpsertEvaluations(body.evaluations, institutionId, user);
  }

  @Post('observations')
  @CheckAbility({ action: Action.Create, subject: 'StudentObservation' })
  @ApiOperation({ summary: 'Guardar observación de un alumno' })
  upsertObservation(
    @Body(new ZodPipe(UpsertObservationSchema)) body: any,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.indicatorsService.upsertObservation(
      { ...body, authorId: user.id },
      institutionId,
      user,
    );
  }

  @Get('observations/:courseId')
  @CheckAbility({ action: Action.Read, subject: 'StudentObservation' })
  @ApiOperation({ summary: 'Obtener observaciones de un curso por período' })
  getCourseObservations(
    @Param('courseId') courseId: string,
    @Query('periodId') periodId: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.indicatorsService.getCourseObservations(courseId, periodId, institutionId);
  }
}
