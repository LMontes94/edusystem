// src/lib/api/reports.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { toast }      from 'sonner';
import { api }        from '@/lib/api';
import { ReportSettings, DEFAULT_SETTINGS, downloadBlob } from '@/app/admin/reports/_components/reports.types';

// ── Settings ──────────────────────────────────
export function useReportSettings() {
  const { data: session } = useSession();
  const institutionId     = session?.user?.institutionId;

  return useQuery<ReportSettings>({
    queryKey: ['report-settings', institutionId],
    queryFn:  async () => {
      const res = await api.get('/reports/settings');
      return Object.keys(res.data).length > 0 ? res.data : DEFAULT_SETTINGS;
    },
    enabled:      !!institutionId,
    initialData:  DEFAULT_SETTINGS,
  });
}

export function useSaveReportSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: ReportSettings) => {
      await api.post('/reports/settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-settings'] });
      toast.success('Configuración guardada');
    },
    onError: () => toast.error('Error al guardar la configuración'),
  });
}

// ── Generar PDF individual ────────────────────
export function useGenerateSingleReport() {
  return useMutation({
    mutationFn: async ({
      studentId, schoolYearId, reportType,
    }: {
      studentId:    string;
      schoolYearId: string;
      reportType:   'secondary' | 'primary';
    }) => {
      const endpoint = reportType === 'secondary'
        ? `/reports/secondary/${studentId}`
        : `/reports/primary/${studentId}`;

      const res = await api.get(endpoint, {
        params:       { schoolYearId },
        responseType: 'blob',
      });

      await downloadBlob(res.data, res.headers['content-disposition'], `reporte_${studentId}.pdf`);
    },
    onSuccess: () => toast.success('PDF generado exitosamente'),
    onError:   () => toast.error('Error al generar el PDF'),
  });
}

// ── Generar ZIP curso completo ────────────────
export function useGenerateBulkReport() {
  return useMutation({
    mutationFn: async ({
      courseId, schoolYearId, reportType,
    }: {
      courseId:     string;
      schoolYearId: string;
      reportType:   'secondary' | 'primary';
    }) => {
      const endpoint = reportType === 'secondary'
        ? `/reports/secondary/bulk/${courseId}`
        : `/reports/primary/bulk/${courseId}`;

      const res = await api.get(endpoint, {
        params:       { schoolYearId },
        responseType: 'blob',
      });

      await downloadBlob(res.data, res.headers['content-disposition'], `boletines_${courseId}.zip`);
    },
    onSuccess: () => toast.success('ZIP generado exitosamente'),
    onError:   () => toast.error('Error al generar el ZIP'),
  });
}