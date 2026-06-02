import {
  Body, Controller, Get, Param, Patch, Post,
  Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClosingGradesService } from './closing-grades.service';
import { ClosePeriodSchema, ReopenPeriodSchema, ClosingGradeQuerySchema } from './dto/closing-grade.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Closing Grades')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('closing-grades')
export class ClosingGradesController {
  constructor(private readonly closingGradesService: ClosingGradesService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'ClosingGrade' })
  @ApiOperation({ summary: 'Listar registros de cierre de período' })
  findAll(
    @InstitutionId() institutionId: string,
    @Query(new ZodPipe(ClosingGradeQuerySchema)) query: any,
  ) {
    return this.closingGradesService.findAll(institutionId, query);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'ClosingGrade' })
  @ApiOperation({ summary: 'Cerrar período para un alumno-materia' })
  close(
    @Body(new ZodPipe(ClosePeriodSchema)) dto: any,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.closingGradesService.close(dto, user, institutionId);
  }

  @Patch(':studentId/:courseSubjectId/:periodId/reopen')
  @CheckAbility({ action: Action.Update, subject: 'ClosingGrade' })
  @ApiOperation({ summary: 'Reabrir período (solo ADMIN/DIRECTOR)' })
  reopen(
    @Param('studentId')       studentId:       string,
    @Param('courseSubjectId') courseSubjectId: string,
    @Param('periodId')        periodId:        string,
    @Body(new ZodPipe(ReopenPeriodSchema)) dto: any,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.closingGradesService.reopen(studentId, courseSubjectId, periodId, dto, user, institutionId);
  }
}
