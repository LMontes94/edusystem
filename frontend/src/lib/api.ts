// src/lib/api.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession, signOut } from 'next-auth/react';
import { toast } from 'sonner';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const MUTATING_METHODS = ['post', 'put', 'patch', 'delete'];

// ── Caché de sesión en memoria ────────────────
// Evita llamar getSession() (que hace HTTP) en cada request de axios.
// Se refresca automáticamente si expiró o si no existe.
let cachedSession: Awaited<ReturnType<typeof getSession>> = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getCachedSession() {
  if (cachedSession && Date.now() < cacheExpiresAt) {
    return cachedSession;
  }
  cachedSession  = await getSession();
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedSession;
}

// Llamar esto al hacer login/logout para invalidar el caché
export function invalidateSessionCache() {
  cachedSession  = null;
  cacheExpiresAt = 0;
}

// ── Instancia principal ───────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request interceptor ───────────────────────
api.interceptors.request.use(async (config) => {
  const session = await getCachedSession();

  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }

  // Bloquear mutaciones si el usuario está en licencia
  const status = (session?.user as any)?.status;
  if (status === 'ON_LEAVE' && MUTATING_METHODS.includes(config.method ?? '')) {
    toast.error('Tu cuenta está en licencia. No podés realizar cambios.');
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
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401) {
      invalidateSessionCache();
      await signOut({ callbackUrl: '/login' });
    }

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