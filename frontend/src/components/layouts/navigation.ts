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
  
  // ── Admin / Director / Secretary ─────────────
  const adminNav: NavItem[] = [
    { name: 'Dashboard',          href: '/admin/dashboard',         icon: LayoutDashboard },
    { name: 'Alumnos',            href: '/admin/students',          icon: GraduationCap   },
    { name: 'Cursos',             href: '/admin/courses',           icon: BookOpen        },
    { name: 'Usuarios',           href: '/admin/users',             icon: Users           },
    { name: 'Materias',           href: '/admin/subjects',          icon: BookOpen        },
    { name: 'Asistencia',         href: '/admin/attendance',        icon: ClipboardList   },
    { name: 'Detalle asistencia', href: '/admin/attendance-detail', icon: BarChart2       },
    { name: 'Notas',              href: '/admin/grades',            icon: Star            },
    { name: 'Comunicados',        href: '/admin/announcements',     icon: Megaphone       },
    { name: 'Indicadores',        href: '/admin/indicators',        icon: ListChecks      },
    { name: 'Evaluaciones',       href: '/admin/evaluations',       icon: ClipboardCheck  },
    { name: 'Reportes',           href: '/admin/reports',           icon: FileText        },
    { name: '— Panel del docente —', separator: true },
    { name: 'Temario',            href: '/admin/syllabus',          icon: BookText        },
    { name: 'Pendientes',         href: '/admin/pending',           icon: Clock           },
    { name: '— Convivencia —',    separator: true },
    { name: 'Convivencia',        href: '/admin/convivencias',      icon: ShieldAlert     },
  ];
  
  // ── Preceptor ─────────────────────────────────
  const preceptorNav: NavItem[] = [
    { name: 'Alumnos',            href: '/admin/students',          icon: GraduationCap   },
    { name: 'Cursos',             href: '/admin/courses',           icon: BookOpen        },
    { name: 'Asistencia',         href: '/admin/attendance',        icon: ClipboardList   },
    { name: 'Detalle asistencia', href: '/admin/attendance-detail', icon: BarChart2       },
    { name: '— Convivencia —',    separator: true },
    { name: 'Convivencia',        href: '/admin/convivencias',      icon: ShieldAlert     },
    { name: '— Reportes —',       separator: true },
    { name: 'Reportes',           href: '/admin/reports',           icon: FileText        },
    { name: 'Pendientes',         href: '/admin/pending',           icon: Clock           },
    { name: 'Comunicados',        href: '/admin/announcements',     icon: Megaphone       },
  ];
  
  // ── Teacher ───────────────────────────────────
  const teacherNav: NavItem[] = [
    { name: 'Dashboard',    href: '/teacher/dashboard',    icon: LayoutDashboard },
    { name: 'Asistencia',   href: '/teacher/attendance',   icon: ClipboardList   },
    { name: 'Notas',        href: '/teacher/grades',       icon: Star            },
    { name: 'Comunicados',  href: '/teacher/announcements',icon: Megaphone       },
    { name: 'Evaluaciones', href: '/teacher/evaluations',  icon: ClipboardCheck  },
    { name: 'Temario',      href: '/teacher/syllabus',     icon: BookText        },
    { name: 'Pendientes',   href: '/teacher/pending',      icon: Clock           },
    { name: 'Comunicados',        href: '/teacher/announcements',     icon: Megaphone},
  ];
  
  // ── Mapa por rol ──────────────────────────────
  export const navigationByRole: Record<string, NavItem[]> = {
    ADMIN:     adminNav,
    DIRECTOR:  adminNav,
    SECRETARY: adminNav,
    PRECEPTOR: preceptorNav,
    TEACHER:   teacherNav,
  };
  
  export function getNavigation(role: string | undefined): NavItem[] {
    return navigationByRole[role ?? ''] ?? teacherNav;
  }
  
  // ── Prefijo de ruta base por rol ──────────────
  // Usado para detectar el item activo correctamente
  export function getDashboardHref(role: string | undefined): string {
    switch (role) {
      case 'ADMIN':
      case 'DIRECTOR':
      case 'SECRETARY':
      case 'PRECEPTOR':
        return '/admin/dashboard';
      default:
        return '/teacher/dashboard';
    }
  }