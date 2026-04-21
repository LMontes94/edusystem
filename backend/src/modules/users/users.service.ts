import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService }   from '../../prisma/prisma.service';
import { RequestUser }     from '../../common/decorators/current-user.decorator';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto, LeaveDto, LevelRoleDto } from './dto/user.dto';
import { StorageService }  from '../storage/storage.service';
import { getHighestRole }  from '../../common/utils/role-hierarchy';
import { Level, Role }     from '@prisma/client';

const USER_SELECT = {
  id: true, email: true, firstName: true, lastName: true,
  role: true, status: true, phone: true, avatarUrl: true,
  institutionId: true, lastLoginAt: true, leaveStartDate: true,
  createdAt: true, updatedAt: true,
  levelRoles: { select: { id: true, level: true, role: true } },
};

const LEAVE_ALLOWED_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY'];

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly storage: StorageService,
  ) {}

  async findAll(institutionId: string, filters?: { level?: Level; role?: Role }) {
    const where: any = { institutionId, deletedAt: null };
    if (filters?.level || filters?.role) {
      const levelRoleWhere: any = {};
      if (filters.level) levelRoleWhere.level = filters.level;
      if (filters.role)  levelRoleWhere.role  = filters.role;
      where.levelRoles = { some: levelRoleWhere };
    }
    return this.prisma.user.findMany({
      where, select: USER_SELECT,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
    });
  }

  async findOne(id: string, institutionId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, institutionId, deletedAt: null }, select: USER_SELECT,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto, institutionId: string, currentUser?: RequestUser) {
    if (currentUser?.role === 'SECRETARY' && !['TEACHER', 'PRECEPTOR'].includes(dto.role)) {
      throw new ForbiddenException('Solo podés crear docentes y preceptores');
    }
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email, institutionId } });
    if (existing) throw new ConflictException('El email ya está en uso en esta institución');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        institutionId, email: dto.email, passwordHash,
        firstName: dto.firstName, lastName: dto.lastName,
        role: dto.role, phone: dto.phone, status: 'ACTIVE',
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, institutionId: string) {
    await this.findOne(id, institutionId);
    return this.prisma.user.update({ where: { id }, data: dto, select: USER_SELECT });
  }

  async changePassword(id: string, dto: ChangePasswordDto, currentUser: RequestUser) {
    if (currentUser.id !== id && currentUser.role !== 'ADMIN') throw new ForbiddenException();
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
    await this.prisma.user.update({
      where: { id }, data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  }

  async grantLeave(id: string, dto: LeaveDto, currentUser: RequestUser) {
    if (!LEAVE_ALLOWED_ROLES.includes(currentUser.role)) {
      throw new ForbiddenException('No tenés permisos para otorgar licencias');
    }
    const user = await this.findOne(id, currentUser.institutionId);
    if (user.status === 'ON_LEAVE') throw new BadRequestException('El usuario ya está en licencia');
    if (user.status === 'INACTIVE') throw new BadRequestException('No se puede poner en licencia a un usuario inactivo');
    return this.prisma.user.update({
      where: { id },
      data:  { status: 'ON_LEAVE', leaveStartDate: new Date(dto.startDate + 'T12:00:00') },
      select: USER_SELECT,
    });
  }

  async revokeLeave(id: string, currentUser: RequestUser) {
    if (!LEAVE_ALLOWED_ROLES.includes(currentUser.role)) {
      throw new ForbiddenException('No tenés permisos para revocar licencias');
    }
    const user = await this.findOne(id, currentUser.institutionId);
    if (user.status !== 'ON_LEAVE') throw new BadRequestException('El usuario no está en licencia');
    return this.prisma.user.update({
      where: { id }, data: { status: 'ACTIVE', leaveStartDate: null }, select: USER_SELECT,
    });
  }

  async addLevelRole(userId: string, data: LevelRoleDto, currentUser: RequestUser) {
    if (!['ADMIN', 'DIRECTOR', 'SECRETARY'].includes(currentUser.role)) {
      throw new ForbiddenException('No tenés permisos para gestionar roles');
    }
    await this.findOne(userId, currentUser.institutionId);

    const existing = await this.prisma.userLevelRole.findFirst({
      where: { userId, level: data.level as Level, role: data.role as Role },
    });
    if (existing) throw new ConflictException('El usuario ya tiene ese rol en ese nivel');

    const levelRole = await this.prisma.userLevelRole.create({
      data: { userId, level: data.level as Level, role: data.role as Role },
    });
    await this.syncHighestRole(userId);
    return levelRole;
  }

  async removeLevelRole(userId: string, levelRoleId: string, currentUser: RequestUser) {
    if (!['ADMIN', 'DIRECTOR', 'SECRETARY'].includes(currentUser.role)) {
      throw new ForbiddenException('No tenés permisos para gestionar roles');
    }
    await this.findOne(userId, currentUser.institutionId);

    const levelRole = await this.prisma.userLevelRole.findFirst({
      where: { id: levelRoleId, userId },
    });
    if (!levelRole) throw new NotFoundException('Rol no encontrado');

    await this.prisma.userLevelRole.delete({ where: { id: levelRoleId } });
    await this.syncHighestRole(userId);
  }

  private async syncHighestRole(userId: string) {
    const levelRoles = await this.prisma.userLevelRole.findMany({
      where: { userId }, select: { role: true },
    });
    if (levelRoles.length === 0) return;
    const highestRole = getHighestRole(levelRoles.map((lr) => lr.role as string)) as Role;
    await this.prisma.user.update({ where: { id: userId }, data: { role: highestRole } });
  }

  async updateAvatar(id: string, file: Express.Multer.File, institutionId: string, currentUser: RequestUser) {
    if (currentUser.id !== id && !['ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(currentUser.role)) {
      throw new ForbiddenException();
    }
    const user = await this.findOne(id, institutionId);
    if (user.avatarUrl) await this.storage.deleteFile(user.avatarUrl);
    const filename   = this.storage.generateFilename(file.originalname);
    const objectName = await this.storage.uploadFile('avatars', filename, file.buffer, file.mimetype);
    await this.prisma.user.update({ where: { id }, data: { avatarUrl: objectName } });
    return { avatarUrl: await this.storage.getFileUrl(objectName) };
  }

  async getAvatarUrl(id: string, institutionId: string) {
    const user = await this.findOne(id, institutionId);
    if (!user.avatarUrl) return { url: null };
    return { url: await this.storage.getFileUrl(user.avatarUrl) };
  }
}