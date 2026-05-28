export type EducationLevel = 'PRIMARY' | 'SECONDARY';

export type ReportType = 'RITE' | 'VALORACIONES' | 'PRIMARY_QUALITATIVE';

export type ReportCategory = 'OFFICIAL' | 'PEDAGOGICAL' | 'INTERNAL';

export type DownloadTarget = 'individual' | 'bulk';

export interface ReportTypeConfig {
  label: string;
  shortLabel: string;
  description: string;
  badge: string;
  badgeVariant: 'default' | 'secondary' | 'outline';
  category: ReportCategory;
  educationLevel: EducationLevel;
  endpoint: string;
  fallbackFilename: string;
  loadingMsg: string;
  successMsg: string;
  errorMsg: string;
  supportsBulk: boolean;
  supportsGuardian: boolean;
  supportsTeacher: boolean;
}

export const REPORT_TYPES: Record<ReportType, ReportTypeConfig> = {
  RITE: {
    label: 'RITE Oficial',
    shortLabel: 'RITE',
    description: 'Registro Institucional de Trayectorias Educativas',
    badge: 'RITE Oficial',
    badgeVariant: 'default',
    category: 'OFFICIAL',
    educationLevel: 'SECONDARY',
    endpoint: '/reports/rite',
    fallbackFilename: 'rite',
    loadingMsg: 'Generando RITE...',
    successMsg: 'RITE generado exitosamente',
    errorMsg: 'No se pudo generar el RITE',
    supportsBulk: true,
    supportsGuardian: true,
    supportsTeacher: true,
  },
  VALORACIONES: {
    label: 'Valoración Preliminar',
    shortLabel: 'Valoraciones',
    description: 'Informe de Valoración Preliminar',
    badge: 'Valoración Preliminar',
    badgeVariant: 'secondary',
    category: 'PEDAGOGICAL',
    educationLevel: 'SECONDARY',
    endpoint: '/reports/valoraciones',
    fallbackFilename: 'valoraciones',
    loadingMsg: 'Generando Valoraciones...',
    successMsg: 'Valoraciones generadas exitosamente',
    errorMsg: 'No se pudieron generar las Valoraciones',
    supportsBulk: true,
    supportsGuardian: true,
    supportsTeacher: true,
  },
  PRIMARY_QUALITATIVE: {
    label: 'Informe Cualitativo',
    shortLabel: 'Primaria',
    description: 'Informe cualitativo de nivel primario',
    badge: 'Informe Cualitativo',
    badgeVariant: 'outline',
    category: 'OFFICIAL',
    educationLevel: 'PRIMARY',
    endpoint: '/reports/primary',
    fallbackFilename: 'informe_primaria',
    loadingMsg: 'Generando informe...',
    successMsg: 'Informe generado exitosamente',
    errorMsg: 'No se pudo generar el informe',
    supportsBulk: true,
    supportsGuardian: true,
    supportsTeacher: true,
  },
};

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  PRIMARY: 'Primaria',
  SECONDARY: 'Secundaria',
};

export const EDUCATION_LEVEL_TO_COURSE_LEVEL: Record<EducationLevel, string> = {
  PRIMARY: 'PRIMARIA',
  SECONDARY: 'SECUNDARIA',
};

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  OFFICIAL: 'Oficial',
  PEDAGOGICAL: 'Pedagógico',
  INTERNAL: 'Interno',
};
