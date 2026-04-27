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
  status:        'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ON_LEAVE';
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

// ── Usuario individual ────────────────────────
export function useUser(id: string) {
  return useQuery<User>({
    queryKey: ['users', id],
    queryFn:  async () => {
      const res = await api.get<User>(`/users/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

// ── Listar todos ──────────────────────────────
export function useUsers(filters?: { level?: string; role?: string }) {
  const params: any = {};
  if (filters?.level) params.level = filters.level;
  if (filters?.role)  params.role  = filters.role;
 
  return useQuery<User[]>({
    queryKey: ['users', filters],
    queryFn:  async () => {
      const res = await api.get<User[]>('/users', { params });
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

// ── Toggle estado activo/inactivo ─────────────
export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/users/${id}`, { status });
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar el estado'),
  });
}

// ── Reset password ────────────────────────────
export function useResetPassword() {
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await api.patch(`/users/${id}/password`, {
        currentPassword: password, // admin reset — el backend lo maneja
        newPassword:     password,
      });
    },
    onSuccess: () => toast.success('Contraseña actualizada'),
    onError:   () => toast.error('Error al cambiar la contraseña'),
  });
}

// ── Actualizar usuario ────────────────────────
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: {
      id:   string;
      data: { firstName?: string; lastName?: string; phone?: string };
    }) => {
      const res = await api.patch(`/users/${id}`, data);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['users', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuario actualizado');
    },
    onError: () => toast.error('Error al actualizar el usuario'),
  });
}