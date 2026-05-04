import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
  } from '@nestjs/common';
  import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
  import { SpaceReservationsService } from './space-reservations.service';
  import {
    CreateSpaceReservationDto,
    CreateSpaceReservationSchema,
    GetReservationsQueryDto,
    GetReservationsQuerySchema,
    UpdateReservationStatusDto,
    UpdateReservationStatusSchema,
    UpdateSpaceReservationDto,
    UpdateSpaceReservationSchema,
  } from './dto/space-reservation.dto';
  import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
  import { InstitutionId } from '../../common/decorators/institution-id.decorator';
  import { ZodPipe } from '../../common/pipes/zod.pipe';
  import { CaslGuard } from '../casl/guards/casl.guard';
  import { CheckAbility } from '../casl/decorators/check-ability.decorator';
  import { Action } from '../casl/casl.types';
  
  @ApiTags('Space Reservations')
  @ApiBearerAuth('JWT')
  @UseGuards(CaslGuard)
  @Controller('space-reservations')
  export class SpaceReservationsController {
    constructor(private readonly service: SpaceReservationsService) {}
  
    @Get()
    @CheckAbility({ action: Action.Read, subject: 'SpaceReservation' })
    @ApiOperation({ summary: 'Listar reservas (filtros: spaceId, month, dateFrom, dateTo)' })
    findAll(
      @InstitutionId() institutionId: string,
      @Query(new ZodPipe(GetReservationsQuerySchema)) query: GetReservationsQueryDto,
    ) {
      return this.service.findAll(institutionId, query);
    }
  
    @Get(':id')
    @CheckAbility({ action: Action.Read, subject: 'SpaceReservation' })
    @ApiOperation({ summary: 'Obtener una reserva' })
    findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
      return this.service.findOne(id, institutionId);
    }
  
    @Post()
    @CheckAbility({ action: Action.Create, subject: 'SpaceReservation' })
    @ApiOperation({ summary: 'Crear reserva (todos excepto GUARDIAN)' })
    create(
      @Body(new ZodPipe(CreateSpaceReservationSchema)) dto: CreateSpaceReservationDto,
      @CurrentUser() user: RequestUser,
      @InstitutionId() institutionId: string,
    ) {
      return this.service.create(institutionId, user.id, dto);
    }
  
    @Patch(':id')
    @CheckAbility({ action: Action.Update, subject: 'SpaceReservation' })
    @ApiOperation({ summary: 'Editar reserva (dueño o admin)' })
    update(
      @Param('id') id: string,
      @Body(new ZodPipe(UpdateSpaceReservationSchema)) dto: UpdateSpaceReservationDto,
      @CurrentUser() user: RequestUser,
      @InstitutionId() institutionId: string,
    ) {
      return this.service.update(id, institutionId, user.id, user.role, dto);
    }
  
    @Patch(':id/status')
    @CheckAbility({ action: Action.Manage, subject: 'SpaceReservation' })
    @ApiOperation({ summary: 'Confirmar o cancelar reserva (ADMIN/DIRECTOR/SECRETARY)' })
    updateStatus(
      @Param('id') id: string,
      @Body(new ZodPipe(UpdateReservationStatusSchema)) dto: UpdateReservationStatusDto,
      @InstitutionId() institutionId: string,
    ) {
      return this.service.updateStatus(id, institutionId, dto);
    }
  
    @Patch(':id/cancel')
    @CheckAbility({ action: Action.Update, subject: 'SpaceReservation' })
    @ApiOperation({ summary: 'Cancelar reserva propia (o cualquiera si es admin)' })
    cancel(
      @Param('id') id: string,
      @CurrentUser() user: RequestUser,
      @InstitutionId() institutionId: string,
    ) {
      return this.service.cancel(id, institutionId, user.id, user.role);
    }
  
    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @CheckAbility({ action: Action.Delete, subject: 'SpaceReservation' })
    @ApiOperation({ summary: 'Eliminar reserva — soft delete (ADMIN/DIRECTOR)' })
    remove(@Param('id') id: string, @InstitutionId() institutionId: string) {
      return this.service.remove(id, institutionId);
    }
  }