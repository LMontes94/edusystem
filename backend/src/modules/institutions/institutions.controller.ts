import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InstitutionsService } from './institutions.service';
import {
  CreateInstitutionDto,
  CreateInstitutionSchema,
  UpdateInstitutionDto,
  UpdateInstitutionSchema,
  InviteUserDto,
  InviteUserSchema,
} from './dto/institution.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';

@ApiTags('Institutions')
@ApiBearerAuth('JWT')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  // ── POST /institutions ───────────────────────
  // @Public() → el onboarding no requiere JWT
  // En producción esto debería protegerse con una API key de plataforma
  @Post()
  @Public()
  @ApiOperation({ summary: 'Crear institución + primer ADMIN (onboarding)' })
  create(
    @Body(new ZodPipe(CreateInstitutionSchema)) dto: CreateInstitutionDto,
  ) {
    return this.institutionsService.create(dto);
  }

  // ── GET /institutions ────────────────────────
  @Get()
  @ApiOperation({ summary: 'Listar todas las instituciones (SUPER_ADMIN)' })
  findAll(@CurrentUser() user: RequestUser) {
    return this.institutionsService.findAll();
  }

  // ── GET /institutions/:id ────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de una institución' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.institutionsService.findOne(id, user);
  }

  // ── PATCH /institutions/:id ──────────────────
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de la institución' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateInstitutionSchema)) dto: UpdateInstitutionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.institutionsService.update(id, dto, user);
  }

  // ── POST /institutions/:id/invite ────────────
  @Post(':id/invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invitar un usuario a la institución' })
  invite(
    @Param('id') institutionId: string,
    @Body(new ZodPipe(InviteUserSchema)) dto: InviteUserDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.institutionsService.invite(institutionId, dto, user);
  }

  // ── GET /institutions/:id/stats ──────────────
  @Get(':id/stats')
  @ApiOperation({ summary: 'Métricas del tenant' })
  getStats(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.institutionsService.getStats(id, user);
  }
}
