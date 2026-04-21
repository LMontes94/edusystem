import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, HttpCode, HttpStatus, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage }   from 'multer';
import { Level, Role }     from '@prisma/client';
import { UsersService }    from './users.service';
import {
  CreateUserDto, CreateUserSchema,
  UpdateUserDto, UpdateUserSchema,
  ChangePasswordDto, ChangePasswordSchema,
  LeaveDto, LeaveSchema,
  LevelRoleDto, LevelRoleSchema,
} from './dto/user.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId }            from '../../common/decorators/institution-id.decorator';
import { ZodPipe }                  from '../../common/pipes/zod.pipe';
import { CaslGuard }                from '../casl/guards/casl.guard';
import { CheckAbility }             from '../casl/decorators/check-ability.decorator';
import { Action }                   from '../casl/casl.types';
import { JwtAuthGuard }             from '../../common/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'User' })
  @ApiOperation({ summary: 'Listar usuarios — filtrar por level y/o role' })
  findAll(
    @InstitutionId() institutionId: string,
    @Query('level')  level?: Level,
    @Query('role')   role?:  Role,
  ) {
    return this.usersService.findAll(institutionId, { level, role });
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'User' })
  findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.usersService.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'User' })
  create(
    @Body(new ZodPipe(CreateUserSchema)) dto: CreateUserDto,
    @InstitutionId() institutionId: string,
    @CurrentUser()   user: RequestUser,
  ) {
    return this.usersService.create(dto, institutionId, user);
  }

  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'User' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateUserSchema)) dto: UpdateUserDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.usersService.update(id, dto, institutionId);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @Param('id') id: string,
    @Body(new ZodPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.changePassword(id, dto, user);
  }

  // ── Licencias ─────────────────────────────────
  @Patch(':id/leave')
  @CheckAbility({ action: Action.Update, subject: 'User' })
  grantLeave(
    @Param('id') id: string,
    @Body(new ZodPipe(LeaveSchema)) dto: LeaveDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.grantLeave(id, dto, user);
  }

  @Patch(':id/restore')
  @CheckAbility({ action: Action.Update, subject: 'User' })
  @HttpCode(HttpStatus.OK)
  revokeLeave(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.usersService.revokeLeave(id, user);
  }

  // ── Roles por nivel ───────────────────────────
  @Post(':id/level-roles')
  @CheckAbility({ action: Action.Update, subject: 'User' })
  @ApiOperation({ summary: 'Agregar rol por nivel a un usuario' })
  addLevelRole(
    @Param('id') id: string,
    @Body(new ZodPipe(LevelRoleSchema)) dto: LevelRoleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.addLevelRole(id, dto, user);
  }

  @Delete(':id/level-roles/:levelRoleId')
  @CheckAbility({ action: Action.Update, subject: 'User' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar rol por nivel de un usuario' })
  removeLevelRole(
    @Param('id')          id:          string,
    @Param('levelRoleId') levelRoleId: string,
    @CurrentUser()        user:        RequestUser,
  ) {
    return this.usersService.removeLevelRole(id, levelRoleId, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'User' })
  remove(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.usersService.remove(id, institutionId);
  }

  @Post(':id/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits:  { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Solo se permiten imágenes'), false);
      }
      cb(null, true);
    },
  }))
  async uploadAvatar(
    @Param('id')   id:   string,
    @UploadedFile() file: Express.Multer.File,
    @InstitutionId() institutionId: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.usersService.updateAvatar(id, file, institutionId, currentUser);
  }

  @Get(':id/avatar-url')
  @CheckAbility({ action: Action.Read, subject: 'User' })
  getAvatarUrl(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.usersService.getAvatarUrl(id, institutionId);
  }
}