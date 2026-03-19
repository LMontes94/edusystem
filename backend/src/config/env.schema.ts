import { z } from 'zod';

// ──────────────────────────────────────────────
// Validación de variables de entorno con Zod.
// Si falta alguna variable requerida, la app
// falla en el arranque con un mensaje claro.
// ──────────────────────────────────────────────

export const envSchema = z.object({
  // ── App ──────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  APP_MODE: z
    .enum(['api', 'worker'])
    .default('api'),

  PORT: z
    .string()
    .default('4000')
    .transform(Number),

  // ── Database ─────────────────────────────────
  DATABASE_URL: z
    .string()
    .url({ message: 'DATABASE_URL debe ser una URL válida de PostgreSQL' }),

  // ── Redis ────────────────────────────────────
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),

  // ── JWT ──────────────────────────────────────
  JWT_SECRET: z
    .string()
    .min(32, { message: 'JWT_SECRET debe tener al menos 32 caracteres' }),

  JWT_REFRESH_SECRET: z
    .string()
    .min(32, { message: 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres' }),

  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ── CORS ─────────────────────────────────────
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // ── Storage ──────────────────────────────────
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().default('9000').transform(Number),
  MINIO_ACCESS_KEY: z.string().default('edusystem_access'),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().default('edusystem'),
  MINIO_USE_SSL: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  // ── Firebase FCM ─────────────────────────────
  FCM_PROJECT_ID: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().email().optional(),

  // ── BullMQ queues ────────────────────────────
  BULL_QUEUE_NOTIFICATIONS: z.string().default('notifications'),
  BULL_QUEUE_PDF: z.string().default('pdf-generation'),
  BULL_QUEUE_AUDIT: z.string().default('audit-log'),
  BULL_QUEUE_GRADES: z.string().default('grade-processing'),
});

export type EnvConfig = z.infer<typeof envSchema>;
