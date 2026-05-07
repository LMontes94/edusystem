import { z } from 'zod';

const id = z.string().min(1);

export const CreateSportGroupSchema = z.object({
  sportId:      id,
  schoolYearId: id,
  name:         z.string().min(1).max(100),
  teacherIds:   z.array(id).min(1, 'El grupo debe tener al menos un docente'),
  studentIds:   z.array(id).optional().default([]),
});

export const UpdateSportGroupSchema = z.object({
  name:       z.string().min(1).max(100).optional(),
  teacherIds: z.array(id).min(1).optional(),
  studentIds: z.array(id).optional(),
});

export const AddStudentsSchema = z.object({
  studentIds: z.array(id).min(1),
});

export const RemoveStudentSchema = z.object({
  studentId: id,
});

export const SportGroupQuerySchema = z.object({
  sportId:      id.optional(),
  schoolYearId: id.optional(),
});

// ─── Asistencia de deportes ───────────────────────────────────────────────────

export const SportAttendanceRecordSchema = z.object({
  studentId:   id,
  status:      z.enum(['PRESENT', 'ABSENT', 'LATE', 'JUSTIFIED']),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export const BulkSportAttendanceSchema = z.object({
  sportGroupId: id,
  courseId:     id,
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
  records:      z.array(SportAttendanceRecordSchema).min(1),
});

export const SportAttendanceQuerySchema = z.object({
  sportGroupId: id.optional(),
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateFrom:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type CreateSportGroupDto     = z.infer<typeof CreateSportGroupSchema>;
export type UpdateSportGroupDto     = z.infer<typeof UpdateSportGroupSchema>;
export type AddStudentsDto          = z.infer<typeof AddStudentsSchema>;
export type RemoveStudentDto        = z.infer<typeof RemoveStudentSchema>;
export type SportGroupQueryDto      = z.infer<typeof SportGroupQuerySchema>;
export type BulkSportAttendanceDto  = z.infer<typeof BulkSportAttendanceSchema>;
export type SportAttendanceQueryDto = z.infer<typeof SportAttendanceQuerySchema>;