'use client';

import { useMyChildren } from '@/lib/api/students';
import { useGrades } from '@/lib/api/grades';
import { useAttendance } from '@/lib/api/attendance';
import { useAnnouncements } from '@/lib/api/announcements';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import {
  Star, ClipboardList, Megaphone, ChevronRight,
} from 'lucide-react';

const statusLabel: Record<string, string> = {
  PRESENT: 'Presente',
  ABSENT: 'Ausente',
  LATE: 'Tarde',
  JUSTIFIED: 'Justificado',
};

const statusColor: Record<string, string> = {
  PRESENT: 'text-emerald-600',
  ABSENT: 'text-red-600',
  LATE: 'text-amber-600',
  JUSTIFIED: 'text-blue-600',
};

export default function GuardianDashboardPage() {
  const { data: children, isLoading: childrenLoading } = useMyChildren();
  const { data: announcements } = useAnnouncements();
  const recentAnnouncements = announcements?.slice(0, 3) ?? [];

  if (childrenLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dashboard familiar</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!children || children.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Dashboard familiar</h1>
        <p className="text-sm text-muted-foreground">
          No hay alumnos vinculados a tu cuenta
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard familiar</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {children.map((child) => (
          <ChildDashboardCard key={child.id} child={child} />
        ))}
      </div>

      {/* Últimos comunicados */}
      {recentAnnouncements.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-muted-foreground" />
              Últimos comunicados
            </CardTitle>
            <Link
              href="/guardian/announcements"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
            >
              Ver todo <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="px-5 pb-4 space-y-3">
            {recentAnnouncements.map((a) => (
              <div key={a.id} className="text-sm">
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {a.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChildDashboardCard({ child }: { child: any }) {
  const course = child.courseStudents?.find(
    (cs: any) => cs.status === 'ACTIVE',
  );

  const { data: grades } = useGrades({ studentId: child.id });
  const recentGrades = grades?.slice(0, 3) ?? [];

  const { data: attendanceRecords } = useAttendance({});
  const childAttendance = attendanceRecords?.filter(
    (r: any) => r.student.id === child.id,
  ) ?? [];

  const presentCount = childAttendance.filter(
    (r: any) => r.status === 'PRESENT',
  ).length;
  const attendancePct = childAttendance.length > 0
    ? Math.round((presentCount / childAttendance.length) * 100)
    : null;

  return (
    <Card>
      <CardHeader className="pb-2 px-5 pt-4">
        <CardTitle className="text-sm font-semibold">
          {child.firstName} {child.lastName}
        </CardTitle>
        {course && (
          <p className="text-xs text-muted-foreground">
            {course.course.grade}° {course.course.division} — {course.course.name}
          </p>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-4 space-y-3">
        {/* Últimas notas */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Star className="h-3 w-3" /> Últimas notas
            </span>
            <Link
              href="/guardian/grades"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Ver todo
            </Link>
          </div>
          {recentGrades.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin notas</p>
          ) : (
            <div className="space-y-1">
              {recentGrades.map((g: any) => (
                <div key={g.id} className="flex items-center justify-between text-xs">
                  <span className="truncate">{g.courseSubject?.subject?.name}</span>
                  <Badge variant="secondary" className="text-[10px] shrink-0 ml-2">
                    {g.score}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Resumen asistencia */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ClipboardList className="h-3 w-3" /> Asistencia
            </span>
            <Link
              href="/guardian/attendance"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Ver todo
            </Link>
          </div>
          {attendancePct === null ? (
            <p className="text-xs text-muted-foreground">Sin registros</p>
          ) : (
            <p className="text-sm font-medium">{attendancePct}% presente</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
