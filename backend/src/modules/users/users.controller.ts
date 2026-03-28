import {
  Body, Controller, Delete, Get, Param,
  Patch, Post, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto, CreateUserSchema,
  UpdateUserDto, UpdateUserSchema,
  ChangePasswordDto, ChangePasswordSchema,
} from './dto/user.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';
import { UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @CheckAbility({ action: Action.Read, subject: 'User' })
  @ApiOperation({ summary: 'Listar usuarios de la institución' })
  findAll(@InstitutionId() institutionId: string) {
    return this.usersService.findAll(institutionId);
  }

  @Get(':id')
  @CheckAbility({ action: Action.Read, subject: 'User' })
  @ApiOperation({ summary: 'Obtener un usuario' })
  findOne(@Param('id') id: string, @InstitutionId() institutionId: string) {
    return this.usersService.findOne(id, institutionId);
  }

  @Post()
  @CheckAbility({ action: Action.Create, subject: 'User' })
  @ApiOperation({ summary: 'Crear usuario (solo ADMIN)' })
  create(
    @Body(new ZodPipe(CreateUserSchema)) dto: CreateUserDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.create(dto, institutionId, user);
  }
  
  @Patch(':id')
  @CheckAbility({ action: Action.Update, subject: 'User' })
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(UpdateUserSchema)) dto: UpdateUserDto,
    @InstitutionId() institutionId: string,
  ) {
    return this.usersService.update(id, dto, institutionId);
  }

  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cambiar contraseña' })
  changePassword(
    @Param('id') id: string,
    @Body(new ZodPipe(ChangePasswordSchema)) dto: ChangePasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.changePassword(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: Action.Delete, subject: 'User' })
  @ApiOperation({ summary: 'Eliminar usuario (soft delete)' })
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
  @ApiOperation({ summary: 'Subir avatar de usuario' })
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @InstitutionId() institutionId: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
      return this.usersService.updateAvatar(id, file, institutionId, currentUser);
  }

  @Get(':id/avatar-url')
@CheckAbility({ action: Action.Read, subject: 'User' })
async getAvatarUrl(
  @Param('id') id: string,
  @InstitutionId() institutionId: string,
) {
  return this.usersService.getAvatarUrl(id, institutionId);
}
}
