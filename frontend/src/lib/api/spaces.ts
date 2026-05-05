// src/lib/api/spaces.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Space {
  id:          string;
  name:        string;
  description: string | null;
  capacity:    number;
  color:       string;
  isAvailable: boolean;
  createdAt:   string;
  updatedAt:   string;
}

export interface SpaceReservation {
  id:          string;
  spaceId:     string;
  userId:      string;
  date:        string;
  startTime:   string;
  endTime:     string;
  title:       string;
  description: string | null;
  status:      'PENDING' | 'CONFIRMED' | 'CANCELLED';
  space:       { id: string; name: string; capacity: number };
  user:        { id: string; firstName: string; lastName: string; email: string };
}

export interface CreateSpaceDto {
  name:         string;
  description?: string;
  capacity:     number;
  color?:       string;
  isAvailable?: boolean;
}

export interface UpdateSpaceDto extends Partial<CreateSpaceDto> {}

export interface CreateSpaceReservationDto {
  spaceId:      string;
  date:         string; // "YYYY-MM-DD"
  startTime:    string; // "HH:MM"
  endTime:      string; // "HH:MM"
  title:        string;
  description?: string;
}

export interface UpdateSpaceReservationDto extends Partial<Omit<CreateSpaceReservationDto, 'spaceId'>> {}

export interface GetReservationsFilters {
  spaceId?:  string;
  month?:    string; // "YYYY-MM"
  dateFrom?: string;
  dateTo?:   string;
}

// ─── Spaces ───────────────────────────────────────────────────────────────────

export function useSpaces() {
  return useQuery({
    queryKey: ['spaces'],
    queryFn:  async () => {
      const res = await api.get<Space[]>('/spaces');
      return res.data;
    },
  });
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSpaceDto) => {
      const res = await api.post<Space>('/spaces', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Espacio creado exitosamente');
    },
    onError: () => toast.error('Error al crear el espacio'),
  });
}

export function useUpdateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSpaceDto }) => {
      const res = await api.patch<Space>(`/spaces/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Espacio actualizado');
    },
    onError: () => toast.error('Error al actualizar el espacio'),
  });
}

export function useToggleSpaceAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<Space>(`/spaces/${id}/toggle-availability`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Disponibilidad actualizada');
    },
    onError: () => toast.error('Error al actualizar la disponibilidad'),
  });
}

export function useDeleteSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/spaces/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Espacio eliminado');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Error al eliminar el espacio';
      toast.error(msg);
    },
  });
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export function useSpaceReservations(filters?: GetReservationsFilters) {
  return useQuery({
    queryKey: ['space-reservations', filters],
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (filters?.spaceId)  params.set('spaceId',  filters.spaceId);
      if (filters?.month)    params.set('month',    filters.month);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo)   params.set('dateTo',   filters.dateTo);
      const res = await api.get<SpaceReservation[]>(`/space-reservations?${params.toString()}`);
      return res.data;
    },
  });
}

export function useCreateSpaceReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSpaceReservationDto) => {
      const res = await api.post<SpaceReservation>('/space-reservations', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-reservations'] });
      toast.success('Reserva creada exitosamente');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Error al crear la reserva';
      toast.error(msg);
    },
  });
}

export function useUpdateSpaceReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSpaceReservationDto }) => {
      const res = await api.patch<SpaceReservation>(`/space-reservations/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-reservations'] });
      toast.success('Reserva actualizada');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message ?? 'Error al actualizar la reserva';
      toast.error(msg);
    },
  });
}

export function useUpdateReservationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'CONFIRMED' | 'CANCELLED' | 'PENDING' }) => {
      const res = await api.patch<SpaceReservation>(`/space-reservations/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-reservations'] });
      toast.success('Estado actualizado');
    },
    onError: () => toast.error('Error al actualizar el estado'),
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<SpaceReservation>(`/space-reservations/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['space-reservations'] });
      toast.success('Reserva cancelada');
    },
    onError: () => toast.error('Error al cancelar la reserva'),
  });
}