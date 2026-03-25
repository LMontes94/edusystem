// src/lib/api/users.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface User {
  id:            string;
  email:         string;
  firstName:     string;
  lastName:      string;
  role:          'ADMIN' | 'TEACHER' | 'GUARDIAN';
  status:        'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  phone?:        string;
  avatarUrl?:    string;
  institutionId: string;
  lastLoginAt?:  string;
  createdAt:     string;
}

export interface CreateUserDto {
  email:     string;
  password:  string;
  firstName: string;
  lastName:  string;
  role:      'ADMIN' | 'TEACHER' | 'GUARDIAN';
  phone?:    string;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn:  async () => {
      const res = await api.get<User[]>('/users');
      return res.data;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateUserDto) => {
      const res = await api.post<User>('/users', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario creado exitosamente');
    },
    onError: (error: any) => {
      if (error?.response?.status === 409) {
        toast.error('Ya existe un usuario con ese email');
      } else {
        toast.error('Error al crear el usuario');
      }
    },
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) => {
      const res = await api.patch<User>(`/users/${id}`, { status });
      return res.data;
    },
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(`Usuario ${user.status === 'ACTIVE' ? 'activado' : 'desactivado'}`);
    },
    onError: () => toast.error('Error al cambiar el estado del usuario'),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.patch(`/users/${id}`, { password });
    },
    onSuccess: () => toast.success('Contraseña actualizada'),
    onError:   () => toast.error('Error al actualizar la contraseña'),
  });
}