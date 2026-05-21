import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import { CreateRoomDto, SendMessageDto, MarkReadDto, QueryRoomsDto, QueryMessagesDto } from './dto/chat.dto';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../queues/queue.constants';
import { ChatGateway } from './chat.gateway';

interface ChatPolicy {
  guardiansCanMessageTeachers: boolean;
  guardiansCanMessageDirectors: boolean;
  guardiansCanMessageSecretariat: boolean;
  guardiansCanMessageAdmin: boolean;
  teachersCanMessageGuardians: boolean;
  teachersCanMessageOtherTeachers: boolean;
  teachersCanMessageStudents: boolean;
  studentsCanMessageTeachers: boolean;
  studentsCanMessageOtherStudents: boolean;
  studentsCanCreateRooms: boolean;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.NOTIFICATIONS)
    private readonly notificationQueue: Queue,
    @InjectQueue(QUEUES.AUDIT)
    private readonly auditQueue: Queue,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async findAllRooms(dto: QueryRoomsDto, user: RequestUser, institutionId: string) {
    const memberRooms = await this.prisma.chatRoomMember.findMany({
      where: { userId: user.id },
      select: { roomId: true },
    });
    const memberRoomIds = memberRooms.map((m) => m.roomId);

    const where: Prisma.ChatRoomWhereInput = {
      id: { in: memberRoomIds },
      institutionId,
    };

    if (dto.type === 'COURSE') {
      where.courseId = { not: null };
    } else if (dto.type === 'DIRECT') {
      where.courseId = null;
      where.type = 'DIRECT';
    } else if (dto.type === 'GROUP') {
      where.courseId = null;
      where.type = 'GROUP';
    }

    if (dto.courseId) {
      where.courseId = dto.courseId;
    }

    const rooms = await this.prisma.chatRoom.findMany({
      where,
      include: {
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
            },
          },
        },
        course: { select: { id: true, name: true, grade: true, division: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: dto.limit + 1,
      cursor: dto.cursor ? { id: dto.cursor } : undefined,
    });

    const hasMore = rooms.length > dto.limit;
    const results = hasMore ? rooms.slice(0, -1) : rooms;
    const nextCursor = hasMore ? results[results.length - 1]?.id : undefined;

    return {
      rooms: results,
      nextCursor,
      hasMore,
    };
  }

  async findOneRoom(roomId: string, user: RequestUser, institutionId: string) {
    const membership = await this.prisma.chatRoomMember.findFirst({
      where: { roomId, userId: user.id },
    });
    if (!membership) {
      throw new ForbiddenException('No tenés acceso a esta sala');
    }

    const room = await this.prisma.chatRoom.findFirst({
      where: { id: roomId, institutionId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
            },
          },
        },
        course: { select: { id: true, name: true, grade: true, division: true } },
      },
    });

    if (!room) throw new NotFoundException('Sala no encontrada');
    return room;
  }

  async createRoom(dto: CreateRoomDto, user: RequestUser, institutionId: string) {
    const policy = await this.getChatPolicy(institutionId);

    if (!this.canCreateRoom(user, policy)) {
      throw new ForbiddenException('No tenés permisos para crear salas de chat');
    }

    if (dto.type === 'DIRECT' && dto.participantIds?.length) {
      const otherUserId = dto.participantIds[0];
      const sortedIds = [user.id, otherUserId].sort();
      const roomHash = `${institutionId}::${sortedIds[0]}::${sortedIds[1]}`;

      const existing = await this.prisma.chatRoom.findFirst({
        where: { directRoomHash: roomHash },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
              },
            },
          },
        },
      });
      if (existing) return existing;

      try {
        const room = await this.prisma.chatRoom.create({
          data: {
            institutionId,
            type: 'DIRECT',
            directRoomHash: roomHash,
            members: {
              create: [
                { userId: user.id },
                { userId: otherUserId },
              ],
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
                },
              },
            },
          },
        });

        await this.auditQueue.add(
          JOBS.AUDIT_LOG,
          {
            institutionId,
            userId: user.id,
            action: 'CREATE',
            resource: 'ChatRoom',
            resourceId: room.id,
            after: { type: room.type, participantCount: 2 },
          },
          JOB_OPTIONS.CRITICAL,
        );

        return room;
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existingOnConflict = await this.prisma.chatRoom.findFirst({
            where: { directRoomHash: roomHash },
            include: {
              members: {
                include: {
                  user: {
                    select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
                  },
                },
              },
            },
          });
          if (existingOnConflict) return existingOnConflict;
        }
        throw err;
      }
    }

    if (dto.participantIds) {
      const canMessage = await this.canMessageParticipants(user, dto.participantIds, institutionId, policy);
      if (!canMessage) {
        throw new ForbiddenException('No podés iniciar conversación con algunos participantes');
      }
    }

    const room = await this.prisma.chatRoom.create({
      data: {
        institutionId,
        name: dto.name,
        type: 'GROUP',
        courseId: dto.courseId,
        members: {
          create: [
            { userId: user.id },
            ...(dto.participantIds?.map((id) => ({ userId: id })) ?? []),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
            },
          },
        },
      },
    });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId: user.id,
        action: 'CREATE',
        resource: 'ChatRoom',
        resourceId: room.id,
        after: { type: room.type, name: room.name, participantCount: dto.participantIds?.length },
      },
      JOB_OPTIONS.CRITICAL,
    );

    return room;
  }

  async findMessages(dto: QueryMessagesDto, user: RequestUser, institutionId: string) {
    const membership = await this.prisma.chatRoomMember.findFirst({
      where: { roomId: dto.roomId, userId: user.id },
    });
    if (!membership) {
      throw new ForbiddenException('No tenés acceso a esta sala');
    }

    const where: Prisma.ChatMessageWhereInput = { roomId: dto.roomId };
    if (dto.before) {
      where.sentAt = { lt: new Date(dto.before) };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: dto.limit + 1,
    });

    const hasMore = messages.length > dto.limit;
    const results = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? results[results.length - 1]?.sentAt.toISOString() : undefined;

    return {
      messages: results.reverse(),
      nextCursor,
      hasMore,
    };
  }

  async sendMessage(dto: SendMessageDto, user: RequestUser, institutionId: string) {
    const membership = await this.prisma.chatRoomMember.findFirst({
      where: { roomId: dto.roomId, userId: user.id },
    });
    if (!membership) {
      throw new ForbiddenException('No tenés acceso a esta sala');
    }

    const policy = await this.getChatPolicy(institutionId);
    if (!this.canSendMessage(user, policy)) {
      throw new ForbiddenException('No podés enviar mensajes');
    }

    const room = await this.prisma.chatRoom.findUnique({
      where: { id: dto.roomId },
      select: { type: true, courseId: true, institutionId: true },
    });

    if (room?.type === 'DIRECT') {
      const otherMember = await this.prisma.chatRoomMember.findFirst({
        where: { roomId: dto.roomId, userId: { not: user.id } },
        include: { user: { select: { id: true, role: true } } },
      });

      if (otherMember) {
        const canMessage = await this.canMessageParticipants(
          user,
          [otherMember.user.id],
          institutionId,
          policy,
        );
        if (!canMessage) {
          throw new ForbiddenException('No podés enviar mensajes a este usuario');
        }
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.chatMessage.create({
        data: {
          roomId: dto.roomId,
          senderId: user.id,
          content: dto.content,
          type: dto.type,
          attachmentUrl: dto.attachmentUrl,
        },
        include: {
          sender: {
            select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
          },
        },
      });

      await tx.chatRoom.update({
        where: { id: dto.roomId },
        data: { lastMessageAt: message.sentAt },
      });

      await tx.chatRoomMember.updateMany({
        where: { roomId: dto.roomId, userId: { not: user.id } },
        data: { unreadCount: { increment: 1 } },
      });

      return message;
    });

    this.chatGateway.notifyNewMessage(dto.roomId, result);

    const members = await this.prisma.chatRoomMember.findMany({
      where: { roomId: dto.roomId, userId: { not: user.id } },
      select: { userId: true },
    });

    const recipientIds = members.map((m) => m.userId);

    if (recipientIds.length > 0) {
      const senderUser = result.sender;
      await this.notificationQueue.add(
        JOBS.CHAT_MESSAGE,
        {
          roomId: dto.roomId,
          messageId: result.id,
          senderId: user.id,
          senderName: `${senderUser.firstName} ${senderUser.lastName}`,
          content: dto.content.substring(0, 100),
          recipientIds,
          institutionId,
        },
        JOB_OPTIONS.DEFAULT,
      );
    }

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId: user.id,
        action: 'CREATE',
        resource: 'ChatMessage',
        resourceId: result.id,
        after: { roomId: dto.roomId, type: dto.type, hasAttachment: !!dto.attachmentUrl },
      },
      JOB_OPTIONS.CRITICAL,
    );

    return result;
  }

  async markRead(dto: MarkReadDto, user: RequestUser, institutionId: string) {
    const membership = await this.prisma.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId: dto.roomId, userId: user.id } },
      select: { unreadCount: true },
    });
    if (!membership) {
      throw new ForbiddenException('No tenés acceso a esta sala');
    }

    if (dto.messageId) {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: dto.messageId, roomId: dto.roomId },
        select: { id: true },
      });
      if (!message) {
        throw new NotFoundException('Mensaje no encontrado');
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.chatMessageRead.upsert({
          where: {
            messageId_userId: { messageId: dto.messageId, userId: user.id },
          },
          create: { messageId: dto.messageId, userId: user.id },
          update: {},
        });

        await tx.chatRoomMember.update({
          where: {
            roomId_userId: { roomId: dto.roomId, userId: user.id },
            unreadCount: { gt: 0 },
          },
          data: { unreadCount: { decrement: 1 } },
        });
      });

      this.chatGateway.notifyMessageRead(dto.roomId, user.id, [dto.messageId]);

      return { success: true };
    }

    const beforeDate = new Date();
    const unreadMessages = await this.prisma.chatMessage.findMany({
      where: {
        roomId: dto.roomId,
        senderId: { not: user.id },
        sentAt: { lte: beforeDate },
        reads: { none: { userId: user.id } },
      },
      select: { id: true },
      take: Math.max(membership.unreadCount, 1),
    });

    if (unreadMessages.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.chatMessageRead.createMany({
          data: unreadMessages.map((m) => ({
            messageId: m.id,
            userId: user.id,
          })),
          skipDuplicates: true,
        });

        await tx.chatRoomMember.update({
          where: { roomId_userId: { roomId: dto.roomId, userId: user.id } },
          data: { unreadCount: { decrement: unreadMessages.length } },
        });
      });
    }

    this.chatGateway.notifyMessageRead(
      dto.roomId,
      user.id,
      unreadMessages.map((m) => m.id),
    );

    return { success: true };
  }

  async getUnreadCount(user: RequestUser, institutionId: string) {
    const memberships = await this.prisma.chatRoomMember.findMany({
      where: { userId: user.id, unreadCount: { gt: 0 } },
      select: { roomId: true, unreadCount: true },
    });

    return {
      total: memberships.reduce((sum, m) => sum + m.unreadCount, 0),
      rooms: memberships.map((m) => ({ roomId: m.roomId, unreadCount: m.unreadCount })),
    };
  }

  private async getChatPolicy(institutionId: string): Promise<ChatPolicy> {
    const policy = await this.prisma.institutionChatPolicy.findUnique({
      where: { institutionId },
    });

    if (!policy) {
      return {
        guardiansCanMessageTeachers: true,
        guardiansCanMessageDirectors: true,
        guardiansCanMessageSecretariat: true,
        guardiansCanMessageAdmin: true,
        teachersCanMessageGuardians: true,
        teachersCanMessageOtherTeachers: false,
        teachersCanMessageStudents: false,
        studentsCanMessageTeachers: false,
        studentsCanMessageOtherStudents: false,
        studentsCanCreateRooms: false,
      };
    }

    return {
      guardiansCanMessageTeachers: policy.guardiansCanMessageTeachers,
      guardiansCanMessageDirectors: policy.guardiansCanMessageDirectors,
      guardiansCanMessageSecretariat: policy.guardiansCanMessageSecretariat,
      guardiansCanMessageAdmin: policy.guardiansCanMessageAdmin,
      teachersCanMessageGuardians: policy.teachersCanMessageGuardians,
      teachersCanMessageOtherTeachers: policy.teachersCanMessageOtherTeachers,
      teachersCanMessageStudents: policy.teachersCanMessageStudents,
      studentsCanMessageTeachers: policy.studentsCanMessageTeachers,
      studentsCanMessageOtherStudents: policy.studentsCanMessageOtherStudents,
      studentsCanCreateRooms: policy.studentsCanCreateRooms,
    };
  }

  private async findDirectRoom(userId1: string, userId2: string, institutionId: string) {
    const room = await this.prisma.chatRoom.findFirst({
      where: {
        type: 'DIRECT',
        institutionId,
        members: { some: { userId: userId1 } },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!room) return null;

    const hasOtherMember = room.members.some((m) => m.userId === userId2);
    return hasOtherMember ? room : null;
  }

  private canCreateRoom(user: RequestUser, policy: ChatPolicy): boolean {
    const adminRoles = ['ADMIN', 'DIRECTOR', 'SECRETARY', 'PRECEPTOR'];
    if (adminRoles.includes(user.role)) return true;
    if (user.role === 'TEACHER') return true;
    if (user.role === 'GUARDIAN') return true;
    return false;
  }

  private canSendMessage(user: RequestUser, policy: ChatPolicy): boolean {
    const adminRoles = ['ADMIN', 'DIRECTOR', 'SECRETARY', 'PRECEPTOR'];
    if (adminRoles.includes(user.role)) return true;
    if (user.role === 'TEACHER') return true;
    if (user.role === 'GUARDIAN') return true;
    return false;
  }

  private async canMessageParticipants(
    user: RequestUser,
    participantIds: string[],
    institutionId: string,
    policy: ChatPolicy,
  ): Promise<boolean> {
    if (
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN' ||
      user.role === 'DIRECTOR' ||
      user.role === 'SECRETARY' ||
      user.role === 'PRECEPTOR'
    ) {
      return true;
    }

    const participants = await this.prisma.user.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, role: true },
    });

    for (const participant of participants) {
      if (user.role === 'GUARDIAN') {
        if (participant.role === 'TEACHER' && !policy.guardiansCanMessageTeachers) return false;
        if (participant.role === 'DIRECTOR' && !policy.guardiansCanMessageDirectors) return false;
        if (participant.role === 'SECRETARY' && !policy.guardiansCanMessageSecretariat) return false;
        if (participant.role === 'ADMIN' && !policy.guardiansCanMessageAdmin) return false;
      }

      if (user.role === 'TEACHER') {
        if (participant.role === 'GUARDIAN' && !policy.teachersCanMessageGuardians) return false;
        if (participant.role === 'TEACHER' && !policy.teachersCanMessageOtherTeachers) return false;
      }
    }

    return true;
  }

  async searchMessages(
    query: string,
    user: RequestUser,
    institutionId: string,
    limit = 20,
    cursor?: string,
  ) {
    const memberRooms = await this.prisma.chatRoomMember.findMany({
      where: { userId: user.id },
      select: { roomId: true },
    });
    const roomIds = memberRooms.map((m) => m.roomId);

    if (roomIds.length === 0) {
      return { messages: [], nextCursor: undefined, hasMore: false };
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        roomId: { in: roomIds },
        content: { contains: query, mode: 'insensitive' },
        ...(cursor ? { sentAt: { lt: new Date(cursor) } } : {}),
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
        },
        room: { select: { id: true, name: true } },
      },
      orderBy: { sentAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    const results = hasMore ? messages.slice(0, -1) : messages;
    const nextCursor = hasMore ? results[results.length - 1]?.sentAt.toISOString() : undefined;

    return { messages: results, nextCursor, hasMore };
  }
}
