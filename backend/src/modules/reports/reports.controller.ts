import {
  Body, Controller, Get, Param, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Reports')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ── Boletín secundaria — un alumno ───────────
  @Get('secondary/:studentId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Generar boletín de secundaria para un alumno' })
  async generateSecondary(
    @Param('studentId') studentId: string,
    @Query('schoolYearId') schoolYearId: string,
    @InstitutionId() institutionId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.reportsService.generateSecondaryReport(
      studentId, institutionId, schoolYearId,
    );

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(buffer);
  }

  // ── Boletín secundaria — curso completo ──────
  @Get('secondary/bulk/:courseId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Generar boletines de secundaria para todo un curso (ZIP)' })
  async generateSecondaryBulk(
    @Param('courseId') courseId: string,
    @Query('schoolYearId') schoolYearId: string,
    @InstitutionId() institutionId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generateSecondaryReportBulk(
      courseId, institutionId, schoolYearId,
    );

    res.set({
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="boletines_secundaria.zip"`,
      'Content-Length':      buffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(buffer);
  }

  // ── Informe cualitativo — un alumno ──────────
  @Get('primary/:studentId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Generar informe cualitativo de primaria para un alumno' })
  async generatePrimary(
    @Param('studentId') studentId: string,
    @Query('schoolYearId') schoolYearId: string,
    @InstitutionId() institutionId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.reportsService.generatePrimaryReport(
      studentId, institutionId, schoolYearId,
    );

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      buffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(buffer);
  }

  // ── Informe cualitativo — curso completo ─────
  @Get('primary/bulk/:courseId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Generar informes cualitativos para todo un curso (ZIP)' })
  async generatePrimaryBulk(
    @Param('courseId') courseId: string,
    @Query('schoolYearId') schoolYearId: string,
    @InstitutionId() institutionId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.generatePrimaryReportBulk(
      courseId, institutionId, schoolYearId,
    );

    res.set({
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="informes_primaria.zip"`,
      'Content-Length':      buffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(buffer);
  }

  // ── Configuración de reportes ─────────────────
  @Post('settings')
  @CheckAbility({ action: Action.Update, subject: 'Institution' })
  @ApiOperation({ summary: 'Actualizar configuración de diseño de reportes' })
  updateSettings(
    @Body() body: {
      primaryColor?:   string;
      secondaryColor?: string;
      textColor?:      string;
      logoPosition?:   'center' | 'left' | 'none';
      layout?:         'classic' | 'institutional' | 'modern';
    },
    @InstitutionId() institutionId: string,
  ) {
    return this.reportsService.updateReportSettings(institutionId, body);
  }

  // ── Obtener configuración actual ──────────────
  @Get('settings')
  @CheckAbility({ action: Action.Read, subject: 'Institution' })
  @ApiOperation({ summary: 'Obtener configuración actual de reportes' })
  async getSettings(@InstitutionId() institutionId: string) {
    const institution = await this.reportsService['prisma'].institution.findUnique({
      where:  { id: institutionId },
      select: { settings: true },
    });
    const settings = (institution?.settings as any) ?? {};
    return settings.report ?? {};
  }
}