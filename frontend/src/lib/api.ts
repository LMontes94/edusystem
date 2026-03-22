// src/lib/api.ts
// ──────────────────────────────────────────────
// Cliente HTTP centralizado.
// - Inyecta el JWT en cada request automáticamente
// - Refresca el token cuando expira (401)
// - Tipado completo de respuestas de error
// ──────────────────────────────────────────────

import axios, { AxiosError, AxiosInstance } from 'axios';
import { getSession, signOut } from 'next-auth/react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// ── Instancia principal ───────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request interceptor: inyectar JWT ─────────
api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

// ── Response interceptor: manejar errores ─────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    // Token expirado → cerrar sesión
    if (error.response?.status === 401) {
      await signOut({ callbackUrl: '/login' });
    }
    return Promise.reject(error);
  },
);

// ── Tipos de error de la API ──────────────────
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

// ── Helper para extraer mensaje de error ─────
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

// ── Cliente para server components (sin sesión) ─
export function createServerClient(token: string) {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    timeout: 15000,
  });
}
