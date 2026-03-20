import {
  Body, Controller, Delete, Get, HttpCode,
  HttpStatus, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnnouncementsService } from './announcements.service';
import {
  CreateAnnouncementDto, CreateAnnouncementSchema,
  UpdateAnnouncementDto, UpdateAnnouncementSchema,
} from './dto/announcement.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Announcements')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'Announcement' })
  @ApiOperation({ summary: 'Listar comunicados (filtrado por rol)' })
  findAll(@InstitutionId() institutionId: string, @CurrentUser() user: RequestUser) {
    return this.announcementsService.findAll(institutionId, user);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'Announcement' })
  findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.announcementsService.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'Announcement' })
  @ApiOperation({ summary: 'Crear comunicado (borrador)' })
  create(
    @Body(new ZodPipe(CreateAnnouncementSchema)) dto: CreateAnnouncementDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.announcementsService.create(dto, user, institutionId);
  }

  @Post(':id/publish')
  @CheckAbility({ action: Action.Update, subject: 'Announcement' })
  @ApiOperation({ summary: 'Publicar comunicado y notificar a los destinatarios' })
  publish(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.announcementsService.publish(id, user, institutionId);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'Announcement' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateAnnouncementSchema)) dto: UpdateAnnouncementDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.announcementsService.update(id, dto, user, institutionId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'Announcement' })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.announcementsService.remove(id, user, institutionId);
  }
}
