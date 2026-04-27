'use client';

import { useRef }   from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api }      from '@/lib/api';
import { toast }    from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button }   from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Clock } from 'lucide-react';

interface Props {
  user: {
    id:          string;
    firstName:   string;
    lastName:    string;
    lastLoginAt?: string | null;
    createdAt:   string;
  };
}

export function AvatarCard({ user }: Props) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const queryClient   = useQueryClient();

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

  const { data: avatarData } = useQuery<{ url: string | null }>({
    queryKey: ['avatar', user.id],
    queryFn:  async () => {
      const res = await api.get(`/users/${user.id}/avatar-url`);
      return res.data;
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/users/${user.id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatar', user.id] });
      toast.success('Avatar actualizado');
    },
    onError: () => toast.error('Error al subir el avatar'),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Máximo 2MB'); return; }
    uploadAvatar.mutate(file);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Perfil
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative group">
          <Avatar className="h-20 w-20">
            {avatarData?.url && <AvatarImage src={avatarData.url} alt={user.firstName} />}
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
        </div>

        <Button
          size="sm" variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAvatar.isPending}
        >
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {uploadAvatar.isPending ? 'Subiendo...' : 'Cambiar foto'}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="w-full space-y-1 text-xs text-muted-foreground text-center">
          <p>
            Último acceso:{' '}
            <span className="font-medium text-foreground">
              {user.lastLoginAt
                ? new Date(user.lastLoginAt).toLocaleDateString('es-AR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : 'Nunca'}
            </span>
          </p>
          <p>
            Miembro desde:{' '}
            <span className="font-medium text-foreground">
              {new Date(user.createdAt).toLocaleDateString('es-AR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}