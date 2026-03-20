import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, Query, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GradesService } from './grades.service';
import {
  CreateGradeDto, CreateGradeSchema,
  UpdateGradeDto, UpdateGradeSchema,
  GradeQueryDto, GradeQuerySchema,
} from './dto/grade.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Grades')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('grades')
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Listar notas (filtrado por rol automáticamente)' })
  findAll(
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
    @Query(new ZodPipe(GradeQuerySchema)) query: GradeQueryDto,
  ) {
    return this.gradesService.findAll(institutionId, user, query);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Obtener una nota' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.gradesService.findOne(id, user);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Grade' })
  @ApiOperation({ summary: 'Cargar nota (ADMIN o TEACHER de la materia)' })
  create(
    @Body(new ZodPipe(CreateGradeSchema)) dto: CreateGradeDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.gradesService.create(dto, user, institutionId);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Grade' })
  @ApiOperation({ summary: 'Actualizar nota' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateGradeSchema)) dto: UpdateGradeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.gradesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'Grade' })
  @ApiOperation({ summary: 'Eliminar nota' })
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.gradesService.remove(id, user);
  }

  @Get('student/:studentId/average/:periodId')
  @CheckAbility({ action: Action.Read, subject: 'Grade' })
  @ApiOperation({ summary: 'Promedio del alumno en un período' })
  getAverage(
    @Param('studentId') studentId: string,
    @Param('periodId') periodId: string,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.gradesService.getAverage(studentId, periodId, user, institutionId);
  }
}
