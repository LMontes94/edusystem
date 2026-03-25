import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/user.dto';

// Campos que nunca se devuelven al cliente
const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  status: true,
  phone: true,
  avatarUrl: true,
  institutionId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(institutionId: string) {
    return this.prisma.user.findMany({
      where: { institutionId, deletedAt: null },
      select: USER_SELECT,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findOne(id: string, institutionId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, institutionId, deletedAt: null },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto, institutionId: string, currentUser?: RequestUser) {
    // SECRETARY solo puede crear TEACHER y PRECEPTOR
   if (currentUser?.role === 'SECRETARY') {
    if (!['TEACHER', 'PRECEPTOR'].includes(dto.role)) {
      throw new ForbiddenException('Solo podés crear docentes y preceptores');
    }
   }

    // Verificar que el email no esté en uso en esta institución
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, institutionId },
    });
    if (existing) {
      throw new ConflictException('El email ya está en uso en esta institución');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.user.create({
      data: {
        institutionId,
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        phone: dto.phone,
        status: 'ACTIVE',
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, institutionId: string) {
    await this.findOne(id, institutionId); // verifica que existe y pertenece al tenant

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    currentUser: RequestUser,
  ) {
    // Solo el propio usuario o un ADMIN puede cambiar contraseña
    if (currentUser.id !== id && currentUser.role !== 'ADMIN') {
      throw new ForbiddenException();
    }

    const user = await this.prisma.user.findFirst({
      where: { id, institutionId: currentUser.institutionId, deletedAt: null },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Contraseña actual incorrecta');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async remove(id: string, institutionId: string) {
    await this.findOne(id, institutionId);

    // Soft delete
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  }
}
