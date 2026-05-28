import type { NavigationConfig } from './types';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen,
  ClipboardList, ClipboardCheck, ListChecks,
  FileText, Megaphone, BookText, Star, Clock,
  ShieldAlert, DoorOpenIcon, CalendarIcon,
  SportShoe, Dumbbell,
} from 'lucide-react';

const adminNav: NavigationConfig = {
  dashboard: { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  groups: [
    {
      title: 'ADMINISTRACIÓN',
      items: [
        { name: 'Usuarios', href: '/admin/users', icon: Users },
        { name: 'Alumnos', href: '/admin/students', icon: GraduationCap },
        { name: 'Cursos', href: '/admin/courses', icon: BookOpen },
        { name: 'Materias', href: '/admin/subjects', icon: BookOpen },
      ],
    },
    {
      title: 'ACADÉMICO',
      items: [
        {
          name: 'Asistencia',
          icon: ClipboardList,
          children: [
            { name: 'Tomar asistencia', href: '/admin/attendance' },
            { name: 'Detalle asistencia', href: '/admin/attendance-detail' },
          ],
        },
        { name: 'Evaluaciones', href: '/admin/evaluations', icon: ClipboardCheck },
        { name: 'Indicadores', href: '/admin/indicators', icon: ListChecks },
        { name: 'Reportes', href: '/admin/reports', icon: FileText },
      ],
    },
    {
      title: 'GESTIÓN DOCENTE',
      items: [
        { name: 'Temario', href: '/admin/syllabus', icon: BookText },
        { name: 'Notas', href: '/admin/grades', icon: Star },
        { name: 'Pendientes', href: '/admin/pending', icon: Clock },
      ],
    },
    {
      title: 'CONVIVENCIA',
      items: [
        { name: 'Convivencia', href: '/admin/convivencias', icon: ShieldAlert },
      ],
    },
    {
      title: 'INSTITUCIÓN',
      items: [
        { name: 'Comunicados', href: '/admin/announcements', icon: Megaphone },
        { name: 'Espacios Institucionales', href: '/admin/space', icon: DoorOpenIcon },
        { name: 'Calendario', href: '/admin/space-reservation', icon: CalendarIcon },
      ],
    },
    {
      title: 'ACTIVIDADES',
      items: [
        { name: 'Deportes', href: '/admin/sport', icon: Dumbbell },
        { name: 'Grupos Edu. Física', href: '/admin/sport/groups', icon: SportShoe },
      ],
    },
  ],
};

const preceptorNav: NavigationConfig = {
  dashboard: { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  groups: [
    {
      title: 'ADMINISTRACIÓN',
      items: [
        { name: 'Alumnos', href: '/admin/students', icon: GraduationCap },
        { name: 'Cursos', href: '/admin/courses', icon: BookOpen },
      ],
    },
    {
      title: 'ACADÉMICO',
      items: [
        {
          name: 'Asistencia',
          icon: ClipboardList,
          children: [
            { name: 'Tomar asistencia', href: '/admin/attendance' },
            { name: 'Detalle asistencia', href: '/admin/attendance-detail' },
          ],
        },
        { name: 'Reportes', href: '/admin/reports', icon: FileText },
      ],
    },
    {
      title: 'GESTIÓN DOCENTE',
      items: [
        { name: 'Pendientes', href: '/admin/pending', icon: Clock },
      ],
    },
    {
      title: 'CONVIVENCIA',
      items: [
        { name: 'Convivencia', href: '/admin/convivencias', icon: ShieldAlert },
      ],
    },
    {
      title: 'INSTITUCIÓN',
      items: [
        { name: 'Comunicados', href: '/admin/announcements', icon: Megaphone },
      ],
    },
  ],
};

const teacherNav: NavigationConfig = {
  dashboard: { name: 'Dashboard', href: '/teacher/dashboard', icon: LayoutDashboard },
  groups: [
    {
      title: 'ACADÉMICO',
      items: [
        { name: 'Asistencia', href: '/teacher/attendance', icon: ClipboardList },
        { name: 'Evaluaciones', href: '/teacher/evaluations', icon: ClipboardCheck },
      ],
    },
    {
      title: 'GESTIÓN DOCENTE',
      items: [
        { name: 'Temario', href: '/teacher/syllabus', icon: BookText },
        { name: 'Notas', href: '/teacher/grades', icon: Star },
        { name: 'Pendientes', href: '/teacher/pending', icon: Clock },
      ],
    },
    {
      title: 'INSTITUCIÓN',
      items: [
        { name: 'Comunicados', href: '/teacher/announcements', icon: Megaphone },
      ],
    },
    {
      title: 'ACTIVIDADES',
      items: [
        { name: 'Grupos Edu. Física', href: '/admin/sport/groups', icon: SportShoe },
      ],
    },
  ],
};

const guardianNav: NavigationConfig = {
  dashboard: { name: 'Dashboard', href: '/guardian/dashboard', icon: LayoutDashboard },
  groups: [
    {
      title: 'ACADÉMICO',
      items: [
        { name: 'Notas', href: '/guardian/grades', icon: Star },
        { name: 'Asistencia', href: '/guardian/attendance', icon: ClipboardList },
      ],
    },
    {
      title: 'CONVIVENCIA',
      items: [
        { name: 'Convivencia', href: '/guardian/convivencias', icon: ShieldAlert },
      ],
    },
    {
      title: 'INSTITUCIÓN',
      items: [
        { name: 'Comunicados', href: '/guardian/announcements', icon: Megaphone },
      ],
    },
  ],
};

const superadminNav: NavigationConfig = {
  dashboard: { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  groups: [
    {
      title: 'INSTITUCIONES',
      items: [
        { name: 'Instituciones', href: '/superadmin/institutions', icon: GraduationCap },
      ],
    },
  ],
};

export const navigationByRole: Record<string, NavigationConfig> = {
  ADMIN: adminNav,
  DIRECTOR: adminNav,
  SECRETARY: adminNav,
  PRECEPTOR: preceptorNav,
  TEACHER: teacherNav,
  GUARDIAN: guardianNav,
  SUPER_ADMIN: superadminNav,
};
