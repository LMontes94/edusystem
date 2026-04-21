import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InstitutionsService } from './institutions.service';
import {
  CreateInstitutionDto, CreateInstitutionSchema,
  UpdateInstitutionDto, UpdateInstitutionSchema,
  InviteUserDto, InviteUserSchema,
  UpdatePlanDto, UpdatePlanSchema,
} from './dto/institution.dto';
import { Public }                               from '../../common/decorators/public.decorator';
import { CurrentUser, RequestUser }             from '../../common/decorators/current-user.decorator';
import { ZodPipe }                              from '../../common/pipes/zod.pipe';
import { CheckAbility }                         from '../casl/decorators/check-ability.decorator';
import { Action }                               from '../casl/casl.types';
import { SkipLeaveCheck }                       from '../../common/guards/on-leave.guard';
import { z }                                    from 'zod';

const AcceptInvitationSchema = z.object({
  token:     z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  password:  z.string().min(8),
});

@ApiTags('Institutions')
@ApiBearerAuth('JWT')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  // ── POST /institutions (onboarding) ──────────
  @Post()
  @Public()
  @ApiOperation({ summary: 'Crear institución + primer ADMIN' })
  create(@Body(new ZodPipe(CreateInstitutionSchema)) dto: CreateInstitutionDto) {
    return this.institutionsService.create(dto);
  }

  // ── GET /institutions (SUPER_ADMIN) ──────────
  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Institution' })
  @ApiOperation({ summary: 'Listar todas las instituciones' })
  findAll() {
    return this.institutionsService.findAll();
  }

  // ── GET /institutions/mine (admin ve la suya) ─
  @Get('mine')
  @CheckAbility({ action: Action.Read, subject: 'Institution' })
  @ApiOperation({ summary: 'Obtener datos de mi institución' })
  findMine(@CurrentUser() user: RequestUser) {
    return this.institutionsService.findMine(user);
  }

  // ── GET /institutions/:id ─────────────────────
  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Institution' })
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.institutionsService.findOne(id, user);
  }

  // ── PATCH /institutions/:id ───────────────────
  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Institution' })
  @ApiOperation({ summary: 'Actualizar datos de la institución' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateInstitutionSchema)) dto: UpdateInstitutionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.institutionsService.update(id, dto, user);
  }

  // ── PATCH /institutions/:id/plan (SUPER_ADMIN) ─
  @Patch(':id/plan')
  @CheckAbility({ action: Action.Update, subject: 'Institution' })
  @ApiOperation({ summary: 'Cambiar plan/status de institución (SUPER_ADMIN)' })
  updatePlan(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdatePlanSchema)) dto: UpdatePlanDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.institutionsService.updatePlan(id, dto, user);
  }

  // ── POST /institutions/:id/invite ─────────────
  @Post(':id/invite')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: Action.Update, subject: 'Institution' })
  @ApiOperation({ summary: 'Invitar usuario a la institución' })
  invite(
    @Param('id') institutionId: string,
    @Body(new ZodPipe(InviteUserSchema)) dto: InviteUserDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.institutionsService.invite(institutionId, dto, user);
  }

  // ── GET /institutions/:id/invitations ─────────
  @Get(':id/invitations')
  @CheckAbility({ action: Action.Update, subject: 'Institution' })
  @ApiOperation({ summary: 'Listar invitaciones de la institución' })
  findInvitations(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.institutionsService.findInvitations(id, user);
  }

  // ── DELETE /institutions/:id/invitations/:invId ─
  @Delete(':id/invitations/:invId')
  @HttpCode(HttpStatus.OK)
  @CheckAbility({ action: Action.Update, subject: 'Institution' })
  @ApiOperation({ summary: 'Revocar invitación' })
  revokeInvitation(
    @Param('id')     id:    string,
    @Param('invId')  invId: string,
    @CurrentUser()   user:  RequestUser,
  ) {
    return this.institutionsService.revokeInvitation(id, invId, user);
  }

  // ── POST /institutions/invitations/accept (público) ─
  @Post('invitations/accept')
  @Public()
  @SkipLeaveCheck()
  @ApiOperation({ summary: 'Aceptar invitación y crear cuenta' })
  acceptInvitation(@Body(new ZodPipe(AcceptInvitationSchema)) body: any) {
    const { token, ...data } = body;
    return this.institutionsService.acceptInvitation(token, data);
  }

  // ── GET /institutions/:id/stats ───────────────
  @Get(':id/stats')
  @CheckAbility({ action: Action.Read, subject: 'Institution' })
  getStats(@Param('id') id: string) {
    return this.institutionsService.getStats(id);
  }
}