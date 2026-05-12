import { z } from 'zod';

const id = z.string().min(1);

export const AssignSubjectSchema = z.object({
  courseSubjectId: id,
  schoolYearId:    id,
  type:            z.enum(['RECURSE', 'EXEMPT']),
  // REGULAR no se asigna manualmente — se deriva del CourseStudent
});

export const UpdateSubjectAssignmentSchema = z.object({
  type: z.enum(['RECURSE', 'EXEMPT']),
});

export const StudentSubjectQuerySchema = z.object({
  schoolYearId: id.optional(),
  type:         z.enum(['REGULAR', 'RECURSE', 'EXEMPT']).optional(),
});

export type AssignSubjectDto              = z.infer<typeof AssignSubjectSchema>;
export type UpdateSubjectAssignmentDto    = z.infer<typeof UpdateSubjectAssignmentSchema>;
export type StudentSubjectQueryDto        = z.infer<typeof StudentSubjectQuerySchema>;