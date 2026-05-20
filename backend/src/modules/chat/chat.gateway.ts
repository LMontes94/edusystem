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
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  institutionId: string | null;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedUsers = new Map<string, AuthenticatedUser>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, institutionId: true, status: true },
      });

      if (!user || user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
        client.disconnect();
        return;
      }

      this.connectedUsers.set(client.id, {
        id: user.id,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
      });

      client.data.user = this.connectedUsers.get(client.id);

      client.emit('connected', { userId: user.id });
    } catch (err) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = this.connectedUsers.get(client.id);
    if (user) {
      this.server.to(`user:${user.id}`).emit('userOffline', { userId: user.id });
      this.connectedUsers.delete(client.id);
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const user = client.data.user as AuthenticatedUser;
    if (!user) return;

    const membership = await this.prisma.chatRoomMember.findFirst({
      where: { roomId: data.roomId, userId: user.id },
    });

    if (!membership) {
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

    const onlineMembers = roomMembers
      .filter((m) => Array.from(this.connectedUsers.values()).some((u) => u.id === m.userId))
      .map((m) => m.user);

    client.emit('roomMembers', { roomId: data.roomId, members: roomMembers });
    client.to(data.roomId).emit('userOnline', { userId: user.id, user: { id: user.id } });

    return { roomId: data.roomId, onlineMembers };
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const user = client.data.user as AuthenticatedUser;
    if (!user) return;

    await client.leave(data.roomId);
    client.to(data.roomId).emit('userOffline', { userId: user.id });

    return { roomId: data.roomId };
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; isTyping: boolean },
  ) {
    const user = client.data.user as AuthenticatedUser;
    if (!user) return;

    const userInfo = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, firstName: true, lastName: true },
    });

    client.to(data.roomId).emit('userTyping', {
      roomId: data.roomId,
      userId: user.id,
      userName: userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : 'Usuario',
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('getOnlineUsers')
  async handleGetOnlineUsers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const roomMembers = await this.prisma.chatRoomMember.findMany({
      where: { roomId: data.roomId },
      select: { userId: true },
    });

    const onlineUserIds = Array.from(this.connectedUsers.values())
      .filter((u) => roomMembers.some((m) => m.userId === u.id))
      .map((u) => u.id);

    return { roomId: data.roomId, onlineUserIds };
  }

  notifyNewMessage(roomId: string, message: any) {
    this.server.to(roomId).emit('newMessage', message);
  }

  notifyMessageRead(roomId: string, userId: string, messageIds: string[]) {
    this.server.to(roomId).emit('messagesRead', { roomId, userId, messageIds });
  }

  notifyUserInvited(roomId: string, user: any, invitedUserId: string) {
    this.server.to(`user:${invitedUserId}`).emit('invitedToRoom', { roomId, user });
  }
}