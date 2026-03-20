import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS } from '../queue.constants';

interface AuditLogPayload {
  institutionId: string;
  userId:        string;
  action:        'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT';
  resource:      string;
  resourceId:    string;
  before?:       object;
  after?:        object;
  ipAddress?:    string;
  userAgent?:    string;
}

// ──────────────────────────────────────────────
// AuditProcessor — persiste logs de auditoría
// de forma asíncrona para no bloquear la API.
//
// Se llama desde cualquier servicio cuando ocurre
// una acción sensible (modificar nota, cambiar usuario, etc.)
// ──────────────────────────────────────────────

@Processor(QUEUES.AUDIT)
export class AuditProcessor {
  private readonly logger = new Logger(AuditProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process(JOBS.AUDIT_LOG)
  async handleAuditLog(job: Job<AuditLogPayload>) {
    const { institutionId, userId, action, resource, resourceId, before, after, ipAddress, userAgent } = job.data;

    try {
      await this.prisma.auditLog.create({
        data: {
          institutionId,
          userId,
          action,
          resource,
          resourceId,
          before: before ?? undefined,
          after:  after  ?? undefined,
          ipAddress,
          userAgent,
        } as any,
      });
    } catch (err) {
      this.logger.error(`Error guardando audit log: ${action} ${resource}/${resourceId}`, err);
      throw err;
    }
  }
}
