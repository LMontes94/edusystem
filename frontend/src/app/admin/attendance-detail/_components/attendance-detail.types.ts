export interface AttendanceSummary {
  student: {
    id:             string;
    firstName:      string;
    lastName:       string;
    documentNumber: string;
  };
  present:   number;
  absent:    number;
  late:      number;
  justified: number;
  total:     number;
  rate:      number;
}

export interface AttendanceRecord {
  id:     string;
  date:   string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'JUSTIFIED';
  student: { id: string; firstName: string; lastName: string };
  course:  { id: string; name: string };
}

export type DetailViewMode = 'summary' | 'ranking' | 'evolution';

export const MONTHS = [
  { value: 'all', label: 'Todo el año' },
  { value: '3',   label: 'Marzo'       },
  { value: '4',   label: 'Abril'       },
  { value: '5',   label: 'Mayo'        },
  { value: '6',   label: 'Junio'       },
  { value: '7',   label: 'Julio'       },
  { value: '8',   label: 'Agosto'      },
  { value: '9',   label: 'Septiembre'  },
  { value: '10',  label: 'Octubre'     },
  { value: '11',  label: 'Noviembre'   },
  { value: '12',  label: 'Diciembre'   },
];

export function rateColor(rate: number) {
  if (rate >= 80) return 'text-emerald-600';
  if (rate >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export function rateBadgeVariant(total: number, rate: number): 'default' | 'secondary' | 'destructive' {
  if (total === 0)   return 'secondary';
  if (rate >= 80)    return 'default';
  if (rate >= 60)    return 'secondary';
  return 'destructive';
}

/** Calcula summaries por alumno a partir de los registros crudos */
export function buildSummaries(
  attendance: AttendanceRecord[],
  courseStudents: any[],
): AttendanceSummary[] {
  const activeStudents = courseStudents?.filter((cs) => cs.status === 'ACTIVE') ?? [];

  return activeStudents
    .map((cs) => {
      const rows      = attendance.filter((a) => a.student.id === cs.student.id);
      const present   = rows.filter((a) => a.status === 'PRESENT').length;
      const absent    = rows.filter((a) => a.status === 'ABSENT').length;
      const late      = rows.filter((a) => a.status === 'LATE').length;
      const justified = rows.filter((a) => a.status === 'JUSTIFIED').length;
      const total     = rows.length;
      const rate      = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
      return { student: cs.student, present, absent, late, justified, total, rate };
    })
    .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName));
}

/** Construye params de fecha para el query */
export function buildDateParams(selectedMonth: string) {
  if (selectedMonth === 'all') return {};
  const year     = new Date().getFullYear();
  const month    = selectedMonth.padStart(2, '0');
  const lastDay  = new Date(parseInt(month) === 12 ? year + 1 : year, parseInt(month), 0).getDate();
  return {
    dateFrom: `${year}-${month}-01`,
    dateTo:   `${year}-${month}-${lastDay}`,
  };
}