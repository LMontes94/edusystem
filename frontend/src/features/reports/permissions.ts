import type { ReportType, DownloadTarget } from './types';
import { REPORT_TYPES } from './types';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY', 'PRECEPTOR'] as const;

export interface CanDownloadParams {
  userRole: string;
  reportType: ReportType;
  target: DownloadTarget;
}

export function canDownloadReport(params: CanDownloadParams): boolean {
  const { userRole, reportType, target } = params;
  const config = REPORT_TYPES[reportType];

  if (!config) return false;

  if (ADMIN_ROLES.includes(userRole as typeof ADMIN_ROLES[number])) {
    return true;
  }

  if (userRole === 'TEACHER') {
    if (!config.supportsTeacher) return false;
    if (target === 'bulk') return config.supportsBulk;
    return true;
  }

  if (userRole === 'GUARDIAN') {
    if (!config.supportsGuardian) return false;
    if (target === 'bulk') return false;
    return true;
  }

  return false;
}
