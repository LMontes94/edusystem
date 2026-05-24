import {
  Body, Controller, Get, Patch, HttpCode, HttpStatus,
  Param, Post, Query, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { ChatPolicyService } from './chat-policy.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateRoomDto, CreateRoomSchema,
  SendMessageDto, SendMessageSchema,
  MarkReadDto, MarkReadSchema,
  QueryRoomsDto, QueryRoomsSchema,
  QueryMessagesDto, QueryMessagesSchema,
  SearchMessagesDto, SearchMessagesSchema,
  AddMembersDto, AddMembersSchema,
  UpdateChatPolicyDto, UpdateChatPolicySchema,
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
  constructor(
    private readonly chatService: ChatService,
    private readonly chatPolicyService: ChatPolicyService,
    private readonly storageService: StorageService,
  ) {}

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
    return this.chatService.findMessages(roomId, dto, user, institutionId);
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

  @Get('messages/search')
  @CheckAbility({ action: Action.Read, subject: 'ChatRoom' })
  @ApiOperation({ summary: 'Buscar mensajes por contenido' })
  searchMessages(
    @Query(new ZodPipe(SearchMessagesSchema)) dto: SearchMessagesDto,
    @InstitutionId() institutionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.searchMessages(dto.q, user, institutionId, dto.limit, dto.cursor);
  }

  @Post('attachments/upload')
  @CheckAbility({ action: Action.Create, subject: 'ChatMessage' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Subir archivo adjunto para chat' })
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('El archivo excede el límite de 10MB');
    }

    const filename = this.storageService.generateFilename(file.originalname);
    const objectName = `chat/${user.institutionId}/${filename}`;

    await this.storageService.uploadFile(
      `chat/${user.institutionId}`,
      filename,
      file.buffer,
      file.mimetype,
    );

    const url = await this.storageService.getFileUrl(objectName);

    return { url, filename: file.originalname, size: file.size, mimetype: file.mimetype };
  }

  @Post('rooms/:roomId/members')
  @CheckAbility({ action: Action.ManageParticipants, subject: 'ChatRoom' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Agregar miembros a una sala' })
  addMembers(
    @Param('roomId') roomId: string,
    @Body(new ZodPipe(AddMembersSchema)) dto: AddMembersDto,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.chatService.addMembers(roomId, dto, user, institutionId);
  }

  @Get('rooms/:roomId/members')
  @CheckAbility({ action: Action.Read, subject: 'ChatRoom' })
  @ApiOperation({ summary: 'Obtener miembros de una sala' })
  getMembers(
    @Param('roomId') roomId: string,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
  ) {
    return this.chatService.getMembers(roomId, user, institutionId);
  }

  @Get('rooms/:roomId/export/pdf')
  @CheckAbility({ action: Action.Export, subject: 'ChatRoom' })
  @ApiOperation({ summary: 'Exportar conversación a PDF' })
  async exportPdf(
    @Param('roomId') roomId: string,
    @CurrentUser() user: RequestUser,
    @InstitutionId() institutionId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.chatService.exportConversationPdf(roomId, user, institutionId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="conversacion.pdf"',
      'Content-Length': buffer.length,
      'Access-Control-Expose-Headers': 'Content-Disposition',
    });
    res.end(buffer);
  }

  @Get('policy')
  @CheckAbility({ action: Action.Read, subject: 'Institution' })
  @ApiOperation({ summary: 'Obtener política de chat de la institución' })
  getPolicy(@InstitutionId() institutionId: string) {
    return this.chatPolicyService.getPolicy(institutionId);
  }

  @Patch('policy')
  @CheckAbility({ action: Action.Update, subject: 'Institution' })
  @ApiOperation({ summary: 'Actualizar política de chat de la institución' })
  updatePolicy(
    @InstitutionId() institutionId: string,
    @Body(new ZodPipe(UpdateChatPolicySchema)) dto: UpdateChatPolicyDto,
  ) {
    return this.chatPolicyService.updatePolicy(institutionId, dto);
  }
}