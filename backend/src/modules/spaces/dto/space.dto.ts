import { z } from 'zod';

// ─── Space ────────────────────────────────────────────────────────────────────

export const CreateSpaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  capacity: z.number().int().min(1),
  isAvailable: z.boolean().optional().default(true),
});

export const UpdateSpaceSchema = CreateSpaceSchema.partial();

export type CreateSpaceDto = z.infer<typeof CreateSpaceSchema>;
export type UpdateSpaceDto = z.infer<typeof UpdateSpaceSchema>;

// ─── SpaceReservation ─────────────────────────────────────────────────────────

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const CreateSpaceReservationSchema = z
  .object({
    spaceId: z.string().cuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
    startTime: z.string().regex(TIME_REGEX, 'Formato esperado: HH:MM'),
    endTime: z.string().regex(TIME_REGEX, 'Formato esperado: HH:MM'),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
  })
  .refine(
    (data) => toMin(data.endTime) > toMin(data.startTime),
    { message: 'La hora de fin debe ser posterior a la hora de inicio', path: ['endTime'] },
  );

export const UpdateSpaceReservationSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startTime: z.string().regex(TIME_REGEX).optional(),
    endTime: z.string().regex(TIME_REGEX).optional(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true;
      return toMin(data.endTime) > toMin(data.startTime);
    },
    { message: 'La hora de fin debe ser posterior a la hora de inicio', path: ['endTime'] },
  );

export const UpdateReservationStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']),
});

export const GetReservationsQuerySchema = z.object({
  spaceId: z.string().cuid().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Formato esperado: YYYY-MM')
    .optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateSpaceReservationDto = z.infer<typeof CreateSpaceReservationSchema>;
export type UpdateSpaceReservationDto = z.infer<typeof UpdateSpaceReservationSchema>;
export type UpdateReservationStatusDto = z.infer<typeof UpdateReservationStatusSchema>;
export type GetReservationsQueryDto = z.infer<typeof GetReservationsQuerySchema>;