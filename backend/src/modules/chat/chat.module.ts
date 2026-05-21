import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatPolicyService } from './chat-policy.service';
import { ChatPresenceService } from './chat-presence.service';
import { ChatGateway } from './chat.gateway';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CaslWsGuard } from '../casl/guards/casl-ws.guard';
import { WsThrottleGuard } from './guards/ws-throttle.guard';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatPolicyService,
    ChatPresenceService,
    ChatGateway,
    CaslWsGuard,
    WsThrottleGuard,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = config.get<number>('REDIS_PORT', 6379);
        return new Redis(port, host);
      },
      inject: [ConfigService],
    },
  ],
  exports: [
    ChatService,
    ChatPolicyService,
    ChatPresenceService,
    ChatGateway,
    'REDIS_CLIENT',
  ],
})
export class ChatModule {}