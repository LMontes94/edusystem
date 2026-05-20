import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  CreateRoomDto, CreateRoomSchema,
  SendMessageDto, SendMessageSchema,
  MarkReadDto, MarkReadSchema,
  QueryRoomsDto, QueryRoomsSchema,
  QueryMessagesDto, QueryMessagesSchema,
} from './dto/chat.dto';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { InstitutionId } from '../../common/decorators/institution-id.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { CaslGuard } from '../casl/guards/casl.guard';
import { CheckAbility } from '../casl/decorators/check-ability.decorator';
import { Action } from '../casl/casl.types';

@ApiTags('Chat')
@ApiBearerAuth('JWT')
@UseGuards(CaslGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('rooms')
  @CheckAbility({ action: Action.Read, subject: 'ChatRoom' })
  @ApiOperation({ summary: 'Listar salas de chat del usuario' })
  findAllRooms(
    @Query(new ZodPipe(QueryRoomsSchema)) dto: QueryRoomsDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.findAllRooms(dto, user, institutionId);
  }

  @Get('rooms/unread')
  @CheckAbility({ action: Action.Read, subject: 'ChatRoom' })
  @ApiOperation({ summary: 'Obtener contador de mensajes no leídos' })
  getUnreadCount(
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.getUnreadCount(user, institutionId);
  }

  @Get('rooms/:id')
  @CheckAbility({ action: Action.Read, subject: 'ChatRoom' })
  @ApiOperation({ summary: 'Obtener detalles de una sala' })
  findOneRoom(
    @Param('id') id: string,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.findOneRoom(id, user, institutionId);
  }

  @Post('rooms')
  @CheckAbility({ action: Action.Create, subject: 'ChatRoom' })
  @ApiOperation({ summary: 'Crear sala de chat' })
  createRoom(
    @Body(new ZodPipe(CreateRoomSchema)) dto: CreateRoomDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.chatService.createRoom(dto, user, institutionId);
  }

  @Get('rooms/:roomId/messages')
  @CheckAbility({ action: Action.Read, subject: 'ChatRoom' })
  @ApiOperation({ summary: 'Listar mensajes de una sala' })
  findMessages(
    @Param('roomId') roomId: string,
    @Query(new ZodPipe(QueryMessagesSchema)) dto: QueryMessagesDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.findMessages({ ...dto, roomId }, user, institutionId);
  }

  @Post('messages')
  @CheckAbility({ action: Action.Create, subject: 'ChatMessage' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Enviar mensaje' })
  sendMessage(
    @Body(new ZodPipe(SendMessageSchema)) dto: SendMessageDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.chatService.sendMessage(dto, user, institutionId);
  }

  @Post('messages/read')
  @CheckAbility({ action: Action.Update, subject: 'ChatRoom' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar mensajes como leídos' })
  markRead(
    @Body(new ZodPipe(MarkReadSchema)) dto: MarkReadDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.chatService.markRead(dto, user, institutionId);
  }
}