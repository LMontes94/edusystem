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
  ) {
    return this.usersService.create(dto, institutionId);
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
}
