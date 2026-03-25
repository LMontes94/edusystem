'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Users, BookOpen, ClipboardCheck, Megaphone } from 'lucide-react';

interface Stats {
  students:        number;
  courses:         number;
  totalUsers:      number;
  users:           Record<string, number>;
  attendanceRate:  number | null;
  attendanceTotal: number;
  recentGrades: {
    id:            string;
    score:         string;
    type:          string;
    date:          string;
    student:       { firstName: string; lastName: string };
    courseSubject: { subject: { name: string } };
    period:        { name: string };
  }[];
  recentAnnouncements: {
    id:          string;
    title:       string;
    publishedAt: string;
    scope:       string;
    author:      { firstName: string; lastName: string };
    course?:     { name: string };
  }[];
}

interface Institution {
  id:     string;
  name:   string;
  plan:   string;
  status: string;
}

const typeLabels: Record<string, string> = {
  EXAM:          'Examen',
  ASSIGNMENT:    'Tarea',
  ORAL:          'Oral',
  PROJECT:       'Proyecto',
  PARTICIPATION: 'Participación',
};

export default function AdminDashboardPage() {
  const { data: session }     = useSession();
  const institutionId         = session?.user?.institutionId ?? null;

  const { data: institution } = useQuery({
    queryKey: ['institution', institutionId],
    queryFn:  async () => {
      const res = await api.get<Institution>(`/institutions/${institutionId}`);
      return res.data;
    },
    enabled: !!institutionId,
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['institution-stats', institutionId],
    queryFn:  async () => {
      const res = await api.get<Stats>(`/institutions/${institutionId}/stats`);
      return res.data;
    },
    enabled: !!institutionId,
    refetchInterval: 60 * 1000, // refrescar cada minuto
  });

  const metrics = [
    {
      title: 'Alumnos',
      value: isLoading ? '...' : stats?.students ?? 0,
      icon:  GraduationCap,
      color: 'text-blue-600',
      bg:    'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: 'Usuarios',
      value: isLoading ? '...' : stats?.totalUsers ?? 0,
      icon:  Users,
      color: 'text-purple-600',
      bg:    'bg-purple-50 dark:bg-purple-950',
    },
    {
      title: 'Cursos activos',
      value: isLoading ? '...' : stats?.courses ?? 0,
      icon:  BookOpen,
      color: 'text-emerald-600',
      bg:    'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      title: 'Asistencia hoy',
      value: isLoading ? '...' : stats?.attendanceRate != null
        ? `${stats?.attendanceRate}%`
        : 'Sin datos',
      icon:  ClipboardCheck,
      color: stats?.attendanceRate != null
        ? stats!.attendanceRate >= 80
          ? 'text-emerald-600'
          : stats!.attendanceRate >= 60
          ? 'text-amber-600'
          : 'text-red-600'
        : 'text-muted-foreground',
      bg: 'bg-amber-50 dark:bg-amber-950',
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {institution?.name ?? 'Cargando...'}
          </p>
        </div>
        {institution && (
          <Badge variant={institution.status === 'ACTIVE' ? 'default' : 'secondary'}>
            {institution.status === 'ACTIVE' ? 'Activo' : institution.status}
          </Badge>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="text-2xl font-semibold mt-1">{metric.value}</p>
                </div>
                <div className={`p-2 rounded-lg ${metric.bg}`}>
                  <metric.icon className={`h-5 w-5 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">

        {/* Últimas notas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Últimas notas cargadas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : !stats?.recentGrades?.length ? (
              <p className="text-sm text-muted-foreground">No hay notas registradas</p>
            ) : (
              <div className="space-y-3">
                {stats.recentGrades.map((grade) => (
                  <div key={grade.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {grade.student.lastName}, {grade.student.firstName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {grade.courseSubject.subject.name} · {grade.period.name} · {typeLabels[grade.type] ?? grade.type}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${
                      Number(grade.score) >= 7
                        ? 'text-emerald-600'
                        : Number(grade.score) >= 4
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {Number(grade.score).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comunicados recientes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Comunicados recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : !stats?.recentAnnouncements?.length ? (
              <p className="text-sm text-muted-foreground">No hay comunicados publicados</p>
            ) : (
              <div className="space-y-3">
                {stats.recentAnnouncements.map((ann) => (
                  <div key={ann.id} className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{ann.title}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {ann.scope === 'INSTITUTION' ? 'Institución' : ann.course?.name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ann.author.firstName} {ann.author.lastName} ·{' '}
                      {new Date(ann.publishedAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usuarios por rol */}
        {stats?.users && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Usuarios por rol</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { role: 'ADMIN',     label: 'Administradores' },
                  { role: 'DIRECTOR',  label: 'Directores'      },
                  { role: 'SECRETARY', label: 'Secretarias'     },
                  { role: 'PRECEPTOR', label: 'Preceptores'     },
                  { role: 'TEACHER',   label: 'Docentes'        },
                  { role: 'GUARDIAN',  label: 'Tutores'         },
                ].filter((r) => stats.users[r.role] > 0).map((r) => (
                  <div key={r.role} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="font-medium">{stats.users[r.role]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}