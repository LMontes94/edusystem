import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const PERIOD_ORDER = ['march', 'august', 'november', 'december', 'february'] as const;

interface IntensificationConfig {
  enabled: boolean;
  activeIntensificationPeriod: string;
  allowPreviousPeriodEditing: boolean;
}

interface PeriodFields {
  march?: string | null;
  august?: string | null;
  november?: string | null;
  december?: string | null;
  february?: string | null;
}

@Injectable()
export class PendingSubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntensificationConfig(institutionId: string): Promise<IntensificationConfig | null> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { settings: true },
    });
    if (!institution) return null;
    const config = (institution.settings as any)?.pendingSubjects as IntensificationConfig | undefined;
    if (!config) return null;
    return config;
  }

  async validatePeriodEdition(
    institutionId: string,
    pendingSubjectId: string,
    dto: PeriodFields,
  ): Promise<void> {
    const config = await this.getIntensificationConfig(institutionId);
    if (!config || !config.enabled) {
      throw new ForbiddenException('La carga de materias pendientes no está habilitada');
    }

    const existing = await this.prisma.pendingSubject.findUnique({
      where: { id: pendingSubjectId },
      select: {
        institutionId: true,
        march: true, august: true, november: true, december: true, february: true,
      },
    });
    if (!existing) throw new NotFoundException('PendingSubject no encontrado');
    if (existing.institutionId !== institutionId) throw new ForbiddenException();

    const modified = this.getModifiedPeriods(existing, dto);
    if (modified.length === 0) return;

    const activePeriod = config.activeIntensificationPeriod.toLowerCase();
    const activeIdx = PERIOD_ORDER.indexOf(activePeriod as typeof PERIOD_ORDER[number]);

    for (const period of modified) {
      const periodIdx = PERIOD_ORDER.indexOf(period as typeof PERIOD_ORDER[number]);

      if (period === activePeriod) continue;

      if (config.allowPreviousPeriodEditing && periodIdx < activeIdx) continue;

      throw new ForbiddenException(
        `El período ${period.toUpperCase()} no está disponible para edición. Período activo: ${config.activeIntensificationPeriod}`,
      );
    }
  }

  async validateEnabled(institutionId: string): Promise<void> {
    const config = await this.getIntensificationConfig(institutionId);
    if (!config || !config.enabled) {
      throw new ForbiddenException('La carga de materias pendientes no está habilitada');
    }
  }

  getModifiedPeriods(
    existing: Record<string, string | null>,
    dto: PeriodFields,
  ): string[] {
    return PERIOD_ORDER.filter((period) => {
      if (!(period in dto)) return false;
      return dto[period] !== existing[period];
    });
  }
}
