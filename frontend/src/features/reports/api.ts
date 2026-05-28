import { useRef, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { downloadBlob } from '@/lib/utils/download/download-blob';
import type { ReportType } from './types';
import { REPORT_TYPES } from './types';

const MINIMUM_INTERVAL_MS = 3000;

interface DownloadParams {
  studentId?: string;
  courseId?: string;
  schoolYearId: string;
}

function useDownloadMutation(
  buildEndpoint: (params: DownloadParams) => string,
  configKey: ReportType,
) {
  const config = REPORT_TYPES[configKey];
  const lastCompletedAt = useRef(0);

  return useMutation({
    mutationFn: async (params: DownloadParams) => {
      const elapsed = Date.now() - lastCompletedAt.current;
      if (elapsed < MINIMUM_INTERVAL_MS) return;

      const endpoint = buildEndpoint(params);

      const res = await api.get(endpoint, {
        params: { schoolYearId: params.schoolYearId },
        responseType: 'blob',
      });

      const isZip = (res.headers['content-type'] ?? '').includes('zip');
      const ext = isZip ? 'zip' : 'pdf';

      await downloadBlob(
        res.data,
        res.headers['content-disposition'],
        `${config.fallbackFilename}.${ext}`,
      );
    },
    onSuccess: () => {
      lastCompletedAt.current = Date.now();
      toast.success(config.successMsg);
    },
    onError: (err: any) => {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
      const msg = err?.response?.data?.message ?? err?.message;
      toast.error(msg ? `${config.errorMsg}: ${msg}` : config.errorMsg);
    },
    gcTime: 0,
  });
}

export function useDownloadRiteReport() {
  return useDownloadMutation(
    (p) => `/reports/rite/${p.studentId}`,
    'RITE',
  );
}

export function useDownloadRiteBulkReport() {
  return useDownloadMutation(
    (p) => `/reports/rite/bulk/${p.courseId}`,
    'RITE',
  );
}

export function useDownloadValoracionesReport() {
  return useDownloadMutation(
    (p) => `/reports/valoraciones/${p.studentId}`,
    'VALORACIONES',
  );
}

export function useDownloadValoracionesBulkReport() {
  return useDownloadMutation(
    (p) => `/reports/valoraciones/bulk/${p.courseId}`,
    'VALORACIONES',
  );
}

export function useDownloadPrimaryReport() {
  return useDownloadMutation(
    (p) => `/reports/primary/${p.studentId}`,
    'PRIMARY_QUALITATIVE',
  );
}

export function useDownloadPrimaryBulkReport() {
  return useDownloadMutation(
    (p) => `/reports/primary/bulk/${p.courseId}`,
    'PRIMARY_QUALITATIVE',
  );
}

export function trackReportDownload(_params: {
  reportType: ReportType;
  target: 'individual' | 'bulk';
  studentId?: string;
  courseId?: string;
  success: boolean;
}) {
  // Stub para analytics futuro
}
