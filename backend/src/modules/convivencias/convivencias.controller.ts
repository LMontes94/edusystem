// src/modules/convivencias/convivencias.controller.ts
import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConvivenciasService } from './convivencias.service';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';

@ApiTags('Convivencias')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('convivencias')
export class ConvivenciasController {
  constructor(private readonly convivenciasService: ConvivenciasService) {}

  @Get()
  @CheckAbility({ action: Action.Read,   subject: 'Convivencia' })
  @ApiOperation({ summary: 'Listar convivencias con filtros' })
  findAll(
    @InstitutionId() institutionId: string,
    @Query('courseId')  courseId?:  string,
    @Query('studentId') studentId?: string,
    @Query('type')      type?:      string,
    @Query('dateFrom')  dateFrom?:  string,
    @Query('dateTo')    dateTo?:    string,
  ) {
    return this.convivenciasService.findAll(institutionId, {
      courseId, studentId, type, dateFrom, dateTo,
    });
  }

  @Get('student/:studentId')
  @CheckAbility({ action: Action.Read,   subject: 'Convivencia' })
  findByStudent(
    @Param('studentId')  studentId:    string,
    @InstitutionId()     institutionId: string,
  ) {
    return this.convivenciasService.findByStudent(studentId, institutionId);
  }

  @Get('stats')
  @CheckAbility({ action: Action.Read,   subject: 'Convivencia' })
  @ApiOperation({ summary: 'Estadísticas de convivencias' })
  getStats(
    @InstitutionId() institutionId: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.convivenciasService.getStats(institutionId, courseId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Convivencia' })
  @ApiOperation({ summary: 'Registrar convivencia' })
  create(
    @Body() body: {
      studentId: string;
      courseId:  string;
      type:      string;
      date:      string;
      reason:    string;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.convivenciasService.create(body, user);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Convivencia' })
  update(
    @Param('id') id: string,
    @Body() body: { type?: string; date?: string; reason?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.convivenciasService.update(id, body, user);
  }

  @Delete(':id')
  @CheckAbility({ action: Action.Delete, subject: 'Convivencia' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.convivenciasService.remove(id, user);
  }
}