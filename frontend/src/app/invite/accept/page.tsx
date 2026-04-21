'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Ruta: /invite/accept?token=xxx
// Página pública (sin auth) donde el usuario invitado crea su cuenta.
// ─────────────────────────────────────────────────────────────────────────────

const roleLabels: Record<string, string> = {
  ADMIN:     'Administrador', DIRECTOR: 'Director',
  SECRETARY: 'Secretaria',   PRECEPTOR: 'Preceptor',
  TEACHER:   'Docente',      GUARDIAN:  'Tutor',
};

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const token        = searchParams.get('token') ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [success,   setSuccess]   = useState(false);

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/institutions/invitations/accept', {
        token, firstName, lastName, password,
      });
      return res.data;
    },
    onSuccess: async (data) => {
      setSuccess(true);
      // Auto-login después de aceptar
      const result = await signIn('credentials', {
        email:    data.user.email,
        password,
        redirect: false,
      });
      if (result?.ok) {
        setTimeout(() => router.push('/admin/dashboard'), 1500);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Error al aceptar la invitación');
    },
  });

  const passwordMatch = password === confirm;
  const canSubmit     = firstName && lastName && password.length >= 8 && passwordMatch && !acceptMutation.isPending;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <p className="font-medium">Link inválido</p>
              <p className="text-sm text-muted-foreground">
                El link de invitación no es válido o expiró.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
              <p className="font-medium">¡Cuenta creada!</p>
              <p className="text-sm text-muted-foreground">
                Iniciando sesión automáticamente...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-sm w-full">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Crear tu cuenta</CardTitle>
          <CardDescription>
            Completá tus datos para activar tu acceso al sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Juan" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Apellido</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="García" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contraseña</label>
            <div className="relative">
              <Input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPass((v) => !v)}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Confirmar contraseña</label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repetí la contraseña"
              className={confirm && !passwordMatch ? 'border-red-400' : ''}
            />
            {confirm && !passwordMatch && (
              <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
            )}
          </div>

          <Button
            className="w-full"
            onClick={() => acceptMutation.mutate()}
            disabled={!canSubmit}
          >
            {acceptMutation.isPending ? 'Creando cuenta...' : 'Crear cuenta y acceder'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}