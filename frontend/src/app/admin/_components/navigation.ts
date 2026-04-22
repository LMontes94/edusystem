import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardList, Star, Megaphone, FileText, ClipboardCheck,
  ListChecks, BookText, Clock, BarChart2, ShieldAlert,
} from 'lucide-react';

export interface NavItem {
  name:       string;
  href?:      string;
  icon?:      React.ElementType;
  separator?: boolean;
}

export const navigation: NavItem[] = [
  { name: 'Dashboard',           href: '/admin/dashboard',         icon: LayoutDashboard },
  { name: 'Alumnos',             href: '/admin/students',          icon: GraduationCap   },
  { name: 'Cursos',              href: '/admin/courses',           icon: BookOpen        },
  { name: 'Usuarios',            href: '/admin/users',             icon: Users           },
  { name: 'Materias',            href: '/admin/subjects',          icon: BookOpen        },
  { name: 'Asistencia',          href: '/admin/attendance',        icon: ClipboardList   },
  { name: 'Detalle asistencia',  href: '/admin/attendance-detail', icon: BarChart2       },
  { name: 'Notas',               href: '/admin/grades',            icon: Star            },
  { name: 'Comunicados',         href: '/admin/announcements',     icon: Megaphone       },
  { name: 'Indicadores',         href: '/admin/indicators',        icon: ListChecks      },
  { name: 'Evaluaciones',        href: '/admin/evaluations',       icon: ClipboardCheck  },
  { name: 'Reportes',            href: '/admin/reports',           icon: FileText        },
  { name: '— Panel del docente —', separator: true },
  { name: 'Temario',             href: '/admin/syllabus',          icon: BookText        },
  { name: 'Pendientes',          href: '/admin/pending',           icon: Clock           },
  { name: '— Convivencia —',     separator: true },
  { name: 'Convivencia',         href: '/admin/convivencias',      icon: ShieldAlert     },
];