import { z } from 'zod';

export const CreateAttendanceSchema = z.object({
  studentId:    z.string().uuid(),
  courseId:     z.string().uuid(),
  date:         z.string().date(),
  status:       z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']),
  arrivalTime:  z.string().optional(), // formato HH:MM
  justification: z.string().max(500).optional(),
});
export type CreateAttendanceDto = z.infer<typeof CreateAttendanceSchema>;

// Carga masiva para un curso completo en un día
export const BulkAttendanceSchema = z.object({
  courseId: z.string().uuid(),
  date:     z.string().date(),
  records:  z.array(z.object({
    studentId:    z.string().uuid(),
    status:       z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']),
    arrivalTime:  z.string().optional(),
    justification: z.string().max(500).optional(),
  })).min(1),
});
export type BulkAttendanceDto = z.infer<typeof BulkAttendanceSchema>;

export const UpdateAttendanceSchema = z.object({
  status:        z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']).optional(),
  arrivalTime:   z.string().optional(),
  justification: z.string().max(500).optional(),
});
export type UpdateAttendanceDto = z.infer<typeof UpdateAttendanceSchema>;

export const AttendanceQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  courseId:  z.string().uuid().optional(),
  date:      z.string().date().optional(),
  dateFrom:  z.string().date().optional(),
  dateTo:    z.string().date().optional(),
});
export type AttendanceQueryDto = z.infer<typeof AttendanceQuerySchema>;
