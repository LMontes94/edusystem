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
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async findAllRooms(dto: QueryRoomsDto, user: RequestUser, institutionId: string) {
    const policy = await this.getChatPolicy(institutionId);
    const memberRooms = await this.prisma.chatRoomMember.findMany({
      where: { userId: user.id },
      select: { roomId: true },
    });
    const memberRoomIds = memberRooms.map((m) => m.roomId);

    const where: any = {
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

    if (dto.type === 'DIRECT' && dto.participantIds && dto.participantIds.length > 1) {
      const existingRoom = await this.findDirectRoom(user.id, dto.participantIds[0], institutionId);
      if (existingRoom) return existingRoom;
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
        type: dto.type === 'DIRECT' ? 'DIRECT' : 'GROUP',
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

    return room;
  }

  async findMessages(dto: QueryMessagesDto, user: RequestUser, institutionId: string) {
    const membership = await this.prisma.chatRoomMember.findFirst({
      where: { roomId: dto.roomId, userId: user.id },
    });
    if (!membership) {
      throw new ForbiddenException('No tenés acceso a esta sala');
    }

    const where: any = { roomId: dto.roomId };
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
          policy
        );
        if (!canMessage) {
          throw new ForbiddenException('No podés enviar mensajes a este usuario');
        }
      }
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        roomId: dto.roomId,
        senderId: user.id,
        content: dto.content,
        type: dto.type,
        attachmentUrl: dto.attachmentUrl,
        readBy: [user.id],
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, role: true, avatarUrl: true },
        },
      },
    });

    await this.prisma.chatRoom.update({
      where: { id: dto.roomId },
      data: { lastMessageAt: message.sentAt },
    });

    this.chatGateway.notifyNewMessage(dto.roomId, message);

    const members = await this.prisma.chatRoomMember.findMany({
      where: { roomId: dto.roomId, userId: { not: user.id } },
      select: { userId: true },
    });

    const recipientIds = members.map((m) => m.userId);

    if (recipientIds.length > 0) {
      const senderUser = await this.prisma.user.findUnique({
        where: { id: user.id },
        select: { firstName: true, lastName: true },
      });
      await Promise.all([
        this.notificationQueue.add(
          JOBS.CHAT_MESSAGE,
          {
            roomId: dto.roomId,
            messageId: message.id,
            senderId: user.id,
            senderName: senderUser ? `${senderUser.firstName} ${senderUser.lastName}` : 'Usuario',
            content: dto.content.substring(0, 100),
            recipientIds,
            institutionId,
          },
          JOB_OPTIONS.DEFAULT
        ),
      ]);
    }

    return message;
  }

  async markRead(dto: MarkReadDto, user: RequestUser, institutionId: string) {
    const membership = await this.prisma.chatRoomMember.findFirst({
      where: { roomId: dto.roomId, userId: user.id },
    });
    if (!membership) {
      throw new ForbiddenException('No tenés acceso a esta sala');
    }

    if (dto.messageId) {
      const message = await this.prisma.chatMessage.findFirst({
        where: { id: dto.messageId, roomId: dto.roomId },
      });
      if (!message) {
        throw new NotFoundException('Mensaje no encontrado');
      }

      const readBy = message.readBy.includes(user.id)
        ? message.readBy
        : [...message.readBy, user.id];

      await this.prisma.chatMessage.update({
        where: { id: dto.messageId },
        data: { readBy },
      });
    } else {
      const unreadMessages = await this.prisma.chatMessage.findMany({
        where: { roomId: dto.roomId },
        select: { id: true, readBy: true },
      });

      const updates = unreadMessages
        .filter((m) => !m.readBy.includes(user.id))
        .map((m) =>
          this.prisma.chatMessage.update({
            where: { id: m.id },
            data: { readBy: { push: user.id } },
          })
        );

      await Promise.all(updates);
    }

    const messageIds = dto.messageId
      ? [dto.messageId]
      : (await this.prisma.chatMessage.findMany({
          where: { roomId: dto.roomId },
          select: { id: true },
        })).map((m) => m.id);

    this.chatGateway.notifyMessageRead(dto.roomId, user.id, messageIds);

    return { success: true };
  }

  async getUnreadCount(user: RequestUser, institutionId: string) {
    const memberRooms = await this.prisma.chatRoomMember.findMany({
      where: { userId: user.id },
      select: { roomId: true },
    });
    const roomIds = memberRooms.map((m) => m.roomId);

    if (roomIds.length === 0) return { total: 0, rooms: [] };

    const allMessages = await this.prisma.chatMessage.findMany({
      where: { roomId: { in: roomIds } },
      select: { roomId: true, readBy: true },
    });

    const unreadByRoom: Record<string, number> = {};
    let totalUnread = 0;

    for (const msg of allMessages) {
      if (!msg.readBy.includes(user.id)) {
        unreadByRoom[msg.roomId] = (unreadByRoom[msg.roomId] || 0) + 1;
        totalUnread++;
      }
    }

    return {
      total: totalUnread,
      rooms: Object.entries(unreadByRoom).map(([roomId, unreadCount]) => ({ roomId, unreadCount })),
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
    policy: ChatPolicy
  ): Promise<boolean> {
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || user.role === 'DIRECTOR' || user.role === 'SECRETARY' || user.role === 'PRECEPTOR') {
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
}