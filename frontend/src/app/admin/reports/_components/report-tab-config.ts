import type { ReportType } from '@/features/reports/types';

export interface ReportTabOption {
  value: ReportType;
  label: string;
  description: string;
}

export const REPORT_TAB_OPTIONS: ReportTabOption[] = [
  {
    value: 'RITE',
    label: 'RITE Oficial',
    description: 'Registro Institucional de Trayectorias Educativas',
  },
  {
    value: 'VALORACIONES',
    label: 'Valoración Preliminar',
    description: 'Informe de Valoración Preliminar',
  },
  {
    value: 'PRIMARY_QUALITATIVE',
    label: 'Informe Cualitativo',
    description: 'Nivel Primario',
  },
];
