import { z } from 'zod';

export const CreateAnnouncementSchema = z.object({
  title:    z.string().min(1).max(200),
  content:  z.string().min(1),
  scope:    z.enum(['INSTITUTION', 'COURSE']),
  courseId: z.string().uuid().optional(),
  attachments: z.array(z.object({
    name: z.string(),
    url:  z.string().url(),
  })).optional(),
});
export type CreateAnnouncementDto = z.infer<typeof CreateAnnouncementSchema>;

export const UpdateAnnouncementSchema = CreateAnnouncementSchema.partial();
export type UpdateAnnouncementDto = z.infer<typeof UpdateAnnouncementSchema>;
