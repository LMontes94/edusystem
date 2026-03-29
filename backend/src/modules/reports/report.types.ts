// src/modules/reports/report.types.ts

export interface ReportTheme {
  primaryColor:   string; // header, tablas
  secondaryColor: string; // subtítulos, bordes
  textColor:      string; // texto principal
}

export type LogoPosition = 'center' | 'left' | 'none';
export type ReportLayout = 'classic' | 'institutional' | 'modern';
export type ReportType   = 'secondary-grades' | 'primary-qualitative';

export interface ReportConfig {
  theme:         ReportTheme;
  logoPosition:  LogoPosition;
  layout:        ReportLayout;
  institutionName: string;
  logoUrl?:      string;
}

export const DEFAULT_THEME: ReportTheme = {
  primaryColor:   '#1e3a5f',
  secondaryColor: '#2d6a9f',
  textColor:      '#1a1a1a',
};

// ── Datos para boletín de secundaria ──────────
export interface SecondaryGradeReport {
  student: {
    firstName:      string;
    lastName:       string;
    documentNumber: string;
  };
  course: {
    name:     string;
    grade:    number;
    division: string;
    level:    string;
  };
  schoolYear: number;
  periods: {
    id:   string;
    name: string;
    order: number;
  }[];
  subjects: {
    name: string;
    code: string;
    gradesByPeriod: Record<string, {
      score:       number | null;
      type:        string;
    }[]>;
    average: number | null;
  }[];
  attendance: {
    present:   number;
    absent:    number;
    late:      number;
    justified: number;
    total:     number;
    rate:      number;
  };
}

// ── Datos para informe cualitativo de primaria ─
export interface PrimaryQualitativeReport {
  student: {
    firstName:      string;
    lastName:       string;
    documentNumber: string;
  };
  course: {
    name:     string;
    grade:    number;
    division: string;
  };
  teachers: string[];
  schoolYear: number;
  periods: {
    id:   string;
    name: string;
  }[];
  areas: {
    name:       string;
    indicators: {
      description: string;
      valuesByPeriod: Record<string, 'achieved' | 'in-progress' | 'not-achieved' | null>;
    }[];
  }[];
  observations: Record<string, string>; // período → observación
  attendance: {
    present:   number;
    absent:    number;
    late:      number;
    total:     number;
    rate:      number;
  };
}