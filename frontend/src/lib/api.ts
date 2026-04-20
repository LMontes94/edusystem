// src/lib/api.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession, signOut } from 'next-auth/react';
import { toast } from 'sonner';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

// ── Instancia principal ───────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request interceptor ───────────────────────
api.interceptors.request.use(async (config) => {
  const session = await getSession();

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  // Bloquear mutaciones si el usuario está en licencia
  const status = (session?.user as any)?.status;
  if (status === 'ON_LEAVE' && MUTATING_METHODS.includes(config.method ?? '')) {
    toast.error('Tu cuenta está en licencia. No podés realizar cambios.');
    // Cancelar la request antes de enviarla
    const controller = new AbortController();
    controller.abort();
    config.signal = controller.signal;
  }

  return config;
});

// ── Response interceptor ──────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    // Ignorar errores de requests canceladas (ON_LEAVE)
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    // Token expirado → cerrar sesión
    if (error.response?.status === 401) {
      await signOut({ callbackUrl: '/login' });
    }

    // 403 de licencia — el toast ya se mostró en el request interceptor,
    // pero por si llega igual desde el backend
    if (error.response?.status === 403) {
      const msg = (error.response.data as ApiError)?.message;
      if (typeof msg === 'string' && msg.includes('licencia')) {
        toast.error(msg);
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

// ── Tipos ─────────────────────────────────────
export interface ApiError {
  statusCode: number;
  error:      string;
  message:    string | string[];
  timestamp:  string;
  path:       string;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiError | undefined;
    if (data?.message) {
      return Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message;
    }
  }
  return 'Ocurrió un error inesperado';
}

export function createServerClient(token: string) {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
    timeout: 15000,
  });
}