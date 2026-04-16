// src/common/guards/on-leave.guard.ts
import {
    CanActivate, ExecutionContext, Injectable, ForbiddenException,
  } from '@nestjs/common';
  import { Reflector }     from '@nestjs/core';
  import { PrismaService } from '../../prisma/prisma.service';
  
  const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
  
  export const SKIP_LEAVE_CHECK_KEY = 'skipLeaveCheck';
  import { SetMetadata } from '@nestjs/common';
  export const SkipLeaveCheck = () => SetMetadata(SKIP_LEAVE_CHECK_KEY, true);
  
  @Injectable()
  export class OnLeaveGuard implements CanActivate {
    constructor(
      private readonly prisma:    PrismaService,
      private readonly reflector: Reflector,
    ) {}
  
    async canActivate(context: ExecutionContext): Promise<boolean> {
      // Verificar si la ruta está eximida
      const skip = this.reflector.getAllAndOverride<boolean>(SKIP_LEAVE_CHECK_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (skip) return true;
  
      const request = context.switchToHttp().getRequest();
      const method  = request.method as string;
  
      // Solo bloquear en métodos mutantes
      if (!MUTATING_METHODS.includes(method)) return true;
  
      const userId = request.user?.id;
      if (!userId) return true; // deja que el auth guard maneje esto
  
      // Permitir siempre cambio de contraseña y endpoints de licencia
      const path: string = request.route?.path ?? '';
      const exemptPaths  = ['/users/:id/password', '/users/:id/leave', '/users/:id/restore'];
      if (exemptPaths.some((p) => path.endsWith(p))) return true;
  
      // Consultar status en DB (cache implícito por Prisma connection pool)
      const user = await this.prisma.user.findUnique({
        where:  { id: userId },
        select: { status: true },
      });
  
      if (user?.status === 'ON_LEAVE') {
        throw new ForbiddenException(
          'Tu cuenta está en licencia. No podés realizar cambios hasta que se reactive. Habla con el Administrador',
        );
      }
  
      return true;
    }
  }