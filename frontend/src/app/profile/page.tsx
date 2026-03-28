'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { User, BookOpen, GraduationCap, Shield, Clock, Phone, Mail } from 'lucide-react';

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  ADMIN:       'Administrador',
  DIRECTOR:    'Director',
  SECRETARY:   'Secretaria',
  PRECEPTOR:   'Preceptor',
  TEACHER:     'Docente',
  GUARDIAN:    'Tutor',
};

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Requerido'),
  newPassword:     z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string().min(8, 'Requerido'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path:    ['confirmPassword'],
});
type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

interface UserProfile {
  id:            string;
  email:         string;
  firstName:     string;
  lastName:      string;
  role:          string;
  status:        string;
  phone?:        string;
  institutionId: string;
  lastLoginAt?:  string;
  createdAt:     string;
}

interface CourseSubject {
  id:          string;
  hoursPerWeek: number | null;
  subject:     { id: string; name: string; code: string; color: string | null };
  course:      { id: string; name: string; grade: number; division: string };
  _count?:     { courseStudents: number };
}

export default function ProfilePage() {
  const { data: session }       = useSession();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Cargar datos del usuario actual
  const { data: profile } = useQuery({
  queryKey: ['profile', session?.user?.id],
  queryFn:  async () => {
    const res = await api.get<UserProfile>(`/users/${session?.user?.id}`);
    // Si el usuario tiene avatar guardado, obtener URL firmada
    if (res.data.avatarUrl) {
      try {
        const urlRes = await api.get<{ url: string }>(
          `/users/${session?.user?.id}/avatar-url`
        );
        setAvatarUrl(urlRes.data.url);
      } catch {}
    }
    return res.data;
  },
  enabled: !!session?.user?.id,
});

  // Cargar materias y cursos si es docente
  const { data: courseSubjects } = useQuery({
    queryKey: ['teacher-subjects', session?.user?.id],
    queryFn:  async () => {
      const res = await api.get<CourseSubject[]>('/courses/my-subjects');
      return res.data;
    },
    enabled: session?.user?.role === 'TEACHER',
  });

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onChangePassword(data: ChangePasswordForm) {
    setSaving(true);
    try {
      await api.patch(`/users/${session?.user?.id}/password`, {
        currentPassword: data.currentPassword,
        newPassword:     data.newPassword,
      });
      toast.success('Contraseña actualizada exitosamente');
      setPasswordDialog(false);
      form.reset();
    } catch (err: any) {
      if (err?.response?.status === 401) {
        toast.error('La contraseña actual es incorrecta');
      } else {
        toast.error('Error al cambiar la contraseña');
      }
    } finally {
      setSaving(false);
    }
  }

  const initials = session?.user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '??';

  // Calcular total de alumnos únicos
  const totalStudents = courseSubjects
    ? new Set(
        courseSubjects.flatMap((cs) =>
          Array.from({ length: cs._count?.courseStudents ?? 0 }, (_, i) => `${cs.course.id}-${i}`)
        )
      ).size
    : 0;
  
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no puede superar 2MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.post(
        `/users/${session?.user?.id}/avatar`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      setAvatarUrl(res.data.avatarUrl);
      toast.success('Avatar actualizado');
    } catch {
      toast.error('Error al subir la imagen');
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          Información de tu cuenta y configuración
        </p>
      </div>

      {/* Avatar y datos principales */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-5">
  <div className="relative group">
    <Avatar className="h-16 w-16">
      {avatarUrl
        ? <AvatarImage src={avatarUrl} alt={session?.user?.name ?? ''} />
        : null
      }
      <AvatarFallback className="text-xl font-medium">{initials}</AvatarFallback>
    </Avatar>
    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
      {uploadingAvatar
        ? <span className="text-white text-xs">...</span>
        : <span className="text-white text-xs">Cambiar</span>
      }
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
        disabled={uploadingAvatar}
      />
    </label>
  </div>
  <div className="flex-1">
    <h2 className="text-lg font-semibold">{session?.user?.name}</h2>
    <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
    <div className="flex items-center gap-2 mt-1.5">
      <Badge>{roleLabels[session?.user?.role as string] ?? session?.user?.role}</Badge>
      {profile?.status === 'ACTIVE' && (
        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
          Activo
        </Badge>
      )}
    </div>
  </div>
</div>
        </CardContent>
      </Card>

      {/* Datos personales */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Nombre completo</dt>
                <dd className="font-medium mt-0.5">{session?.user?.name}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="font-medium mt-0.5">{session?.user?.email}</dd>
              </div>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <dt className="text-xs text-muted-foreground">Teléfono</dt>
                  <dd className="font-medium mt-0.5">{profile.phone}</dd>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Miembro desde</dt>
                <dd className="font-medium mt-0.5">
                  {profile?.createdAt
                    ? new Date(profile.createdAt).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })
                    : '—'}
                </dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <dt className="text-xs text-muted-foreground">Último acceso</dt>
                <dd className="font-medium mt-0.5">
                  {profile?.lastLoginAt
                    ? new Date(profile.lastLoginAt).toLocaleDateString('es-AR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : 'Primera sesión'}
                </dd>
              </div>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Materias y cursos — solo para docentes */}
      {session?.user?.role === 'TEACHER' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Mis materias y cursos
              </CardTitle>
              {courseSubjects && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {courseSubjects.length} materias
                  </span>
                  <span className="flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {courseSubjects.reduce((acc, cs) => acc + (cs._count?.courseStudents ?? 0), 0)} alumnos
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!courseSubjects?.length ? (
              <p className="text-sm text-muted-foreground">Sin materias asignadas</p>
            ) : (
              <div className="space-y-2">
                {courseSubjects.map((cs) => (
                  <div
                    key={cs.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      {cs.subject.color && (
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: cs.subject.color }}
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium">{cs.subject.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {cs.course.name}
                          {cs.hoursPerWeek && ` · ${cs.hoursPerWeek}hs/sem`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        {cs._count?.courseStudents ?? 0} alumnos
                      </span>
                      <Badge variant="outline">{cs.subject.code}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Seguridad */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Contraseña</p>
              <p className="text-xs text-muted-foreground">
                Cambiá tu contraseña regularmente para mayor seguridad
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPasswordDialog(true)}
            >
              Cambiar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog cambiar contraseña */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onChangePassword)} className="space-y-4">
              <FormField control={form.control} name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña actual</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva contraseña</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar nueva contraseña</FormLabel>
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPasswordDialog(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : 'Actualizar'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}