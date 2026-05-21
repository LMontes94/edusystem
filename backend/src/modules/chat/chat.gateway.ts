import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatPresenceService } from './chat-presence.service';
import { WsUser } from '../../common/decorators/ws-user.decorator';
import { ThrottleWs } from './decorators/throttle-ws.decorator';
import { WsThrottleGuard } from './guards/ws-throttle.guard';
import { CaslWsGuard } from '../casl/guards/casl-ws.guard';
import { CheckAbilityWs } from '../casl/decorators/check-ability-ws.decorator';
import { Action } from '../casl/casl.types';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  institutionId: string | null;
  status: string;
  firstName: string;
  lastName: string;
}

interface MessagePayload {
  id: string;
  roomId: string;
  senderId: string;
  content: string | null;
  type: string;
  attachmentUrl: string | null;
  sentAt: Date;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl: string | null;
  };
}

@WebSocketGateway({
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly chatPresenceService: ChatPresenceService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          institutionId: true,
          status: true,
          firstName: true,
          lastName: true,
        },
      });

      if (!user || user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
        client.disconnect();
        return;
      }

      client.data.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
      } satisfies AuthenticatedUser;

      await this.chatPresenceService.userConnected(user.id, client.id);

      client.emit('connected', { userId: user.id });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    try {
      const user = client.data.user as AuthenticatedUser | undefined;
      if (user) {
        const stillOnline = await this.chatPresenceService.userDisconnected(
          user.id,
          client.id,
        );
        if (!stillOnline && this.server) {
          this.server.to(`user:${user.id}`).emit('userOffline', { userId: user.id });
        }
      }
    } catch (err) {
      this.logger.error(`Error en disconnect para socket ${client.id}`, err);
    }
  }

  private async verifyRoomAccess(
    userId: string,
    roomId: string,
    institutionId: string | null,
  ): Promise<boolean> {
    if (!institutionId) {
      const membership = await this.prisma.chatRoomMember.findFirst({
        where: { roomId, userId },
      });
      return !!membership;
    }

    const membership = await this.prisma.chatRoomMember.findFirst({
      where: { roomId, userId },
      include: { room: { select: { institutionId: true } } },
    });

    if (!membership) return false;
    if (membership.room.institutionId !== institutionId) return false;

    return true;
  }

  private readonly BLOCKED_STATUSES = new Set(['ON_LEAVE', 'INACTIVE', 'SUSPENDED']);

  private checkUserStatus(client: Socket, user: AuthenticatedUser): boolean {
    if (this.BLOCKED_STATUSES.has(user.status)) {
      this.logger.debug(`WS blocked: user=${user.id} status=${user.status}`);
      client.emit('error', { message: 'Tu cuenta no puede realizar esta acción' });
      return true;
    }
    return false;
  }

  @SubscribeMessage('joinRoom')
  @UseGuards(WsThrottleGuard)
  @UseGuards(CaslWsGuard)
  @CheckAbilityWs({ action: Action.Read, subject: 'ChatRoom' })
  @ThrottleWs(10, 60000)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @WsUser() user: AuthenticatedUser,
    @MessageBody() data: { roomId: string },
  ) {
    if (!user) return;
    if (this.checkUserStatus(client, user)) return;

    const hasAccess = await this.verifyRoomAccess(user.id, data.roomId, user.institutionId);
    if (!hasAccess) {
      client.emit('error', { message: 'No tenés acceso a esta sala' });
      return;
    }

    await client.join(data.roomId);
    await client.join(`user:${user.id}`);

    const roomMembers = await this.prisma.chatRoomMember.findMany({
      where: { roomId: data.roomId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const memberUserIds = roomMembers.map((m) => m.userId);
    const onlineUserIds = await this.chatPresenceService.getOnlineUsers(memberUserIds);
    const onlineMembers = roomMembers
      .filter((m) => onlineUserIds.has(m.userId))
      .map((m) => m.user);

    client.emit('roomMembers', { roomId: data.roomId, members: roomMembers });
    client.to(data.roomId).emit('userOnline', { userId: user.id, user: { id: user.id } });

    return { roomId: data.roomId, onlineMembers };
  }

  @SubscribeMessage('leaveRoom')
  @UseGuards(WsThrottleGuard)
  @UseGuards(CaslWsGuard)
  @CheckAbilityWs({ action: Action.Read, subject: 'ChatRoom' })
  @ThrottleWs(10, 60000)
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @WsUser() user: AuthenticatedUser,
    @MessageBody() data: { roomId: string },
  ) {
    if (!user) return;
    if (this.checkUserStatus(client, user)) return;

    const hasAccess = await this.verifyRoomAccess(user.id, data.roomId, user.institutionId);
    if (!hasAccess) {
      client.emit('error', { message: 'No tenés acceso a esta sala' });
      return;
    }

    await client.leave(data.roomId);
    client.to(data.roomId).emit('userOffline', { userId: user.id });

    return { roomId: data.roomId };
  }

  @SubscribeMessage('typing')
  @UseGuards(WsThrottleGuard)
  @UseGuards(CaslWsGuard)
  @CheckAbilityWs({ action: Action.Read, subject: 'ChatRoom' })
  @ThrottleWs(1, 500)
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @WsUser() user: AuthenticatedUser,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ) {
    if (!user) return;
    if (this.checkUserStatus(client, user)) return;

    const hasAccess = await this.verifyRoomAccess(user.id, data.roomId, user.institutionId);
    if (!hasAccess) {
      client.emit('error', { message: 'No tenés acceso a esta sala' });
      return;
    }

    client.to(data.roomId).emit('userTyping', {
      roomId: data.roomId,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('heartbeat')
  @UseGuards(WsThrottleGuard)
  @ThrottleWs(1, 5000)
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @WsUser() user: AuthenticatedUser,
  ) {
    if (!user) return;
    if (this.checkUserStatus(client, user)) return;
    await this.chatPresenceService.heartbeat(user.id);
  }

  @SubscribeMessage('getOnlineUsers')
  @UseGuards(WsThrottleGuard)
  @UseGuards(CaslWsGuard)
  @CheckAbilityWs({ action: Action.Read, subject: 'ChatRoom' })
  @ThrottleWs(10, 60000)
  async handleGetOnlineUsers(
    @ConnectedSocket() client: Socket,
    @WsUser() user: AuthenticatedUser,
    @MessageBody() data: { roomId: string },
  ) {
    if (!user) return;
    if (this.checkUserStatus(client, user)) return;

    const hasAccess = await this.verifyRoomAccess(user.id, data.roomId, user.institutionId);
    if (!hasAccess) {
      client.emit('error', { message: 'No tenés acceso a esta sala' });
      return;
    }

    const roomMembers = await this.prisma.chatRoomMember.findMany({
      where: { roomId: data.roomId },
      select: { userId: true },
    });

    const memberUserIds = roomMembers.map((m) => m.userId);
    const onlineUserIds = await this.chatPresenceService.getOnlineUsers(memberUserIds);

    return { roomId: data.roomId, onlineUserIds: [...onlineUserIds] };
  }

  notifyNewMessage(roomId: string, message: MessagePayload) {
    if (this.server) {
      this.server.to(roomId).emit('newMessage', message);
    }
  }

  notifyMessageRead(roomId: string, userId: string, messageIds: string[]) {
    if (this.server) {
      this.server.to(roomId).emit('messagesRead', { roomId, userId, messageIds });
    }
  }

  notifyUserInvited(roomId: string, user: { id: string }, invitedUserId: string) {
    if (this.server) {
      this.server.to(`user:${invitedUserId}`).emit('invitedToRoom', { roomId, user });
    }
  }
}
