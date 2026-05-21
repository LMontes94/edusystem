import { z } from 'zod';

export const CreateRoomSchema = z.object({
  name: z.string().max(100).optional(),
  type: z.enum(['DIRECT', 'GROUP']),
  participantIds: z.array(z.string().uuid()).min(1).max(20).optional(),
  courseId: z.string().uuid().optional(),
});

export type CreateRoomDto = z.infer<typeof CreateRoomSchema>;

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  type: z.enum(['TEXT', 'FILE', 'IMAGE']).default('TEXT'),
  attachmentUrl: z.string().url().optional(),
  roomId: z.string().uuid(),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;

export const MarkReadSchema = z.object({
  roomId: z.string().uuid(),
  messageId: z.string().uuid().optional(),
});

export type MarkReadDto = z.infer<typeof MarkReadSchema>;

export const QueryRoomsSchema = z.object({
  type: z.enum(['DIRECT', 'GROUP', 'COURSE']).optional(),
  courseId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export type QueryRoomsDto = z.infer<typeof QueryRoomsSchema>;

export const QueryMessagesSchema = z.object({
  roomId: z.string().uuid(),
  limit: z.coerce.number().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

export type QueryMessagesDto = z.infer<typeof QueryMessagesSchema>;

export const SearchMessagesSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().datetime().optional(),
});

export type SearchMessagesDto = z.infer<typeof SearchMessagesSchema>;

export const UpdateChatPolicySchema = z.object({
  guardiansCanMessageTeachers: z.boolean().optional(),
  guardiansCanMessageDirectors: z.boolean().optional(),
  guardiansCanMessageSecretariat: z.boolean().optional(),
  guardiansCanMessageAdmin: z.boolean().optional(),
  teachersCanMessageGuardians: z.boolean().optional(),
  teachersCanMessageOtherTeachers: z.boolean().optional(),
  teachersCanMessageStudents: z.boolean().optional(),
  studentsCanMessageTeachers: z.boolean().optional(),
  studentsCanMessageOtherStudents: z.boolean().optional(),
  studentsCanCreateRooms: z.boolean().optional(),
  requireModerationForNewRooms: z.boolean().optional(),
  allowAnonymousReporting: z.boolean().optional(),
});

export type UpdateChatPolicyDto = z.infer<typeof UpdateChatPolicySchema>;