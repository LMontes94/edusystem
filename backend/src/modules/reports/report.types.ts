export interface ReportTheme {
  primaryColor:   string;
  secondaryColor: string;
  textColor:      string;
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

export type TrayectoriaStrategy = 'MAJORITY' | 'STRICT' | 'WEIGHTED' | 'CUSTOM';

export type ReportVariant = 'DEFAULT' | 'RITE_BA' | 'SANTA_TERESITA';

export type ObservationType = 'PEDAGOGICAL' | 'DISCIPLINARY' | 'GENERAL';

export type ConvivenciaType = 'OBSERVACION' | 'APERCIBIMIENTO';

export interface RiteSubjectEntry {
  subjectId: string;
  courseSubjectId?: string;
  subjectName: string;
  code: string;
  cursada: 'C' | 'R' | 'E';
  preliminary1: 'TEA' | 'TEP' | 'TED' | null;
  grade1: number | null;
  preliminary2: 'TEA' | 'TEP' | 'TED' | null;
  grade2: number | null;
  intensificacionDec: string | null;
  intensificacionFeb: string | null;
  finalGrade: number | null;
  observations?: { type: ObservationType; text: string }[];
}

export interface AttendanceByPeriod {
  firstC:  { present: number; absent: number; late: number; justified: number; total: number; rate: number };
  secondC: { present: number; absent: number; late: number; justified: number; total: number; rate: number };
  total:   { present: number; absent: number; late: number; justified: number; total: number; rate: number };
}

export interface RiteReport {
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
  variant: ReportVariant;
  subjects: RiteSubjectEntry[];
  attendance: AttendanceByPeriod;
  convivencias: { date: string; type: ConvivenciaType; description: string }[];
}

export interface ValoracionReport {
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
  variant: ReportVariant;
  subjects: {
    subjectId:   string;
    subjectName: string;
    code:        string;
    indicators: { description: string; value: string }[];
    trayectoria: 'TEA' | 'TEP' | 'TED';
    observations?: { type: ObservationType; text: string }[];
  }[];
}

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
      valuesByPeriod: Record<string, string | null>;
    }[];
  }[];
  observations: Record<string, string>;
  attendance: {
    present:   number;
    absent:    number;
    late:      number;
    total:     number;
    rate:      number;
  };
}
