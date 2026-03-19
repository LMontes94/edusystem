import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// ──────────────────────────────────────────────
// GlobalExceptionFilter — captura todos los errores
// y los devuelve con un formato consistente:
//
//   {
//     statusCode: 400,
//     error: "Bad Request",
//     message: "...",
//     timestamp: "2025-...",
//     path: "/api/v1/grades"
//   }
//
// Maneja casos especiales:
//   • ZodError → 400 con detalle de campos
//   • Prisma P2002 (unique constraint) → 409
//   • Prisma P2025 (not found) → 404
//   • Errores genéricos → 500 (sin exponer detalles en prod)
// ──────────────────────────────────────────────

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.resolveError(exception);

    // Log completo del error (siempre)
    this.logger.error(
      `${request.method} ${request.url} → ${statusCode}`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(statusCode).json({
      statusCode,
      error: HttpStatus[statusCode] ?? 'Error',
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private resolveError(exception: unknown): {
    statusCode: number;
    message: string | string[];
  } {
    // NestJS HttpException (incluye BadRequest, Forbidden, etc.)
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'object' && 'message' in response
          ? (response as { message: string | string[] }).message
          : exception.message;

      return { statusCode: exception.getStatus(), message };
    }

    // Zod validation error → 400 con lista de campos inválidos
    if (exception instanceof ZodError) {
      const messages = exception.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      return { statusCode: HttpStatus.BAD_REQUEST, message: messages };
    }

    // Prisma: violación de unique constraint → 409
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        const fields = (exception.meta?.target as string[])?.join(', ');
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `Ya existe un registro con ${fields ?? 'esos valores'}`,
        };
      }

      // Prisma: registro no encontrado → 404
      if (exception.code === 'P2025') {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro no encontrado',
        };
      }
    }

    // Error desconocido → 500
    // En producción no exponemos el mensaje interno
    const isDev = process.env.NODE_ENV === 'development';
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: isDev
        ? (exception instanceof Error ? exception.message : String(exception))
        : 'Error interno del servidor',
    };
  }
}
