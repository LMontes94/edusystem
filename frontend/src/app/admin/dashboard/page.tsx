'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Users, BookOpen, ClipboardList } from 'lucide-react';

// ── Tipos ─────────────────────────────────────
interface InstitutionStats {
  users:    number;
  students: number;
  courses:  number;
}

interface Institution {
  id:     string;
  name:   string;
  plan:   string;
  status: string;
  _count: { users: number; students: number; courses: number };
}

// ── Hooks ─────────────────────────────────────
function useInstitutionStats(institutionId: string | null) {
  return useQuery({
    queryKey: ['institution-stats', institutionId],
    queryFn:  async () => {
      const res = await api.get<InstitutionStats>(`/institutions/${institutionId}/stats`);
      return res.data;
    },
    enabled: !!institutionId,
  });
}

function useInstitution(institutionId: string | null) {
  return useQuery({
    queryKey: ['institution', institutionId],
    queryFn:  async () => {
      const res = await api.get<Institution>(`/institutions/${institutionId}`);
      return res.data;
    },
    enabled: !!institutionId,
  });
}

// ── Componente ────────────────────────────────
export default function AdminDashboardPage() {
  const { data: session }   = useSession();
  const institutionId       = session?.user?.institutionId ?? null;
  const { data: stats }     = useInstitutionStats(institutionId);
  const { data: institution } = useInstitution(institutionId);

  const metrics = [
    {
      title: 'Alumnos',
      value: stats?.students ?? '—',
      icon:  GraduationCap,
      color: 'text-blue-600',
      bg:    'bg-blue-50',
    },
    {
      title: 'Usuarios',
      value: stats?.users ?? '—',
      icon:  Users,
      color: 'text-purple-600',
      bg:    'bg-purple-50',
    },
    {
      title: 'Cursos',
      value: stats?.courses ?? '—',
      icon:  BookOpen,
      color: 'text-emerald-600',
      bg:    'bg-emerald-50',
    },
    {
      title: 'Plan',
      value: institution?.plan ?? '—',
      icon:  ClipboardList,
      color: 'text-amber-600',
      bg:    'bg-amber-50',
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

      {/* Info institución */}
      {institution && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Información de la institución</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Nombre</dt>
                <dd className="font-medium mt-0.5">{institution.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium mt-0.5">{institution.plan}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estado</dt>
                <dd className="font-medium mt-0.5">{institution.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rol</dt>
                <dd className="font-medium mt-0.5 capitalize">
                  {session?.user?.role?.toLowerCase()}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
