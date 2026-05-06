import {
  Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SportsService } from './sports.service';
import {
  CreateSportDto, CreateSportSchema,
  UpdateSportDto, UpdateSportSchema,
} from './dto/sport.dto';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe }       from '../../common/pipes/zod.pipe';
import { CaslGuard }     from '../casl/guards/casl.guard';
import { CheckAbility }  from '../casl/decorators/check-ability.decorator';
import { Action }        from '../casl/casl.types';

@ApiTags('Sports')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('sports')
export class SportsController {
  constructor(private readonly sportsService: SportsService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Sport' })
  @ApiOperation({ summary: 'Listar deportes de la institución' })
  findAll(@InstitutionId() institutionId: string) {
    return this.sportsService.findAll(institutionId);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Sport' })
  @ApiOperation({ summary: 'Obtener un deporte' })
  findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.sportsService.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Sport' })
  @ApiOperation({ summary: 'Crear deporte (ADMIN/DIRECTOR/SECRETARY)' })
  create(
    @Body(new ZodPipe(CreateSportSchema)) dto: CreateSportDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.sportsService.create(institutionId, dto);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Sport' })
  @ApiOperation({ summary: 'Actualizar deporte' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateSportSchema)) dto: UpdateSportDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.sportsService.update(id, institutionId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'Sport' })
  @ApiOperation({ summary: 'Eliminar deporte (soft delete)' })
  remove(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.sportsService.remove(id, institutionId);
  }
}