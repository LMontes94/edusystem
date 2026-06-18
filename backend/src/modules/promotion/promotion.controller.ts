import {
  Body, Controller, Get, Post, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PromotionPreviewService } from './services/promotion-preview.service';
import { PromotionExecutionService } from './services/promotion-execution.service';
import { PromotionOverrideService } from './services/promotion-override.service';
import { PromotionReportingService } from './services/promotion-reporting.service';
import { CreateOverrideSchema, CreateOverrideDto } from './dto/create-override.dto';
import { ResultQuerySchema, ResultQueryDto } from './dto/query-results.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Promotion')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('promotion')
export class PromotionController {
  constructor(
    private readonly promotionPreviewService: PromotionPreviewService,
    private readonly promotionExecutionService: PromotionExecutionService,
    private readonly promotionOverrideService: PromotionOverrideService,
    private readonly promotionReportingService: PromotionReportingService,
  ) {}

  @Get('preview/:schoolYearId')
  @CheckAbility({ action: Action.Read, subject: 'PromotionResult' })
  @ApiOperation({ summary: 'Previsualizar resultados de promoción' })
  preview(
    @Param('schoolYearId') schoolYearId: string,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.promotionPreviewService.preview(schoolYearId, institutionId, user.id);
  }

  @Post('execute/:schoolYearId')
  @CheckAbility({ action: Action.Create, subject: 'PromotionExecution' })
  @ApiOperation({ summary: 'Ejecutar promoción' })
  execute(
    @Param('schoolYearId') schoolYearId: string,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.promotionExecutionService.execute(schoolYearId, institutionId, user.id);
  }

  @Post('override')
  @CheckAbility({ action: Action.Create, subject: 'PromotionResult' })
  @ApiOperation({ summary: 'Crear resultado de promoción manual' })
  createOverride(
    @Body(new ZodPipe(CreateOverrideSchema)) dto: CreateOverrideDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.promotionOverrideService.createOverride(dto, institutionId, user.id);
  }

  @Get('results')
  @CheckAbility({ action: Action.Read, subject: 'PromotionResult' })
  @ApiOperation({ summary: 'Obtener resultados de promoción' })
  getResults(
    @Query(new ZodPipe(ResultQuerySchema)) query: ResultQueryDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.promotionReportingService.getResults(query, institutionId);
  }

  @Get('statistics/:schoolYearId')
  @CheckAbility({ action: Action.Read, subject: 'PromotionResult' })
  @ApiOperation({ summary: 'Obtener estadísticas de promoción' })
  getStatistics(
    @Param('schoolYearId') schoolYearId: string,
    @InstitutionId() institutionId: string,
  ) {
    return this.promotionReportingService.getStatistics(schoolYearId, institutionId);
  }

  @Get('student-history/:studentId')
  @CheckAbility({ action: Action.Read, subject: 'PromotionResult' })
  @ApiOperation({ summary: 'Obtener historial de promoción de un alumno' })
  getStudentHistory(
    @Param('studentId') studentId: string,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.promotionReportingService.getStudentHistory(studentId, institutionId, user);
  }
}
