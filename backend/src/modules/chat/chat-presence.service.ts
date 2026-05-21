import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

const PRESENCE_PREFIX = 'chat:presence';
const PRESENCE_TTL = 300;

@Injectable()
export class ChatPresenceService {
  private readonly logger = new Logger(ChatPresenceService.name);

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async userConnected(userId: string, socketId: string): Promise<void> {
    try {
      const key = `${PRESENCE_PREFIX}:${userId}`;
      await this.redis.sadd(key, socketId);
      await this.redis.expire(key, PRESENCE_TTL);
    } catch (err) {
      this.logger.error(`Presence userConnected error for ${userId}`, err);
    }
  }

  async userDisconnected(userId: string, socketId: string): Promise<boolean> {
    try {
      const key = `${PRESENCE_PREFIX}:${userId}`;
      const remaining = await this.redis.srem(key, socketId);
      if (remaining === 0) {
        await this.redis.del(key);
        return false;
      }
      await this.redis.expire(key, PRESENCE_TTL);
      return true;
    } catch (err) {
      this.logger.error(`Presence userDisconnected error for ${userId}`, err);
      return false;
    }
  }

  async heartbeat(userId: string): Promise<void> {
    try {
      const key = `${PRESENCE_PREFIX}:${userId}`;
      const exists = await this.redis.exists(key);
      if (exists) {
        await this.redis.expire(key, PRESENCE_TTL);
      }
    } catch (err) {
      this.logger.error(`Presence heartbeat error for ${userId}`, err);
    }
  }

  async isOnline(userId: string): Promise<boolean> {
    try {
      const count = await this.redis.scard(`${PRESENCE_PREFIX}:${userId}`);
      return count > 0;
    } catch (err) {
      this.logger.error(`Presence isOnline error for ${userId}`, err);
      return false;
    }
  }

  async getOnlineUsers(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();

    try {
      const pipeline = this.redis.pipeline();
      for (const uid of userIds) {
        pipeline.scard(`${PRESENCE_PREFIX}:${uid}`);
      }
      const results = await pipeline.exec();

      const online = new Set<string>();
      if (results) {
        for (let i = 0; i < results.length; i++) {
          const [err, count] = results[i];
          if (!err && typeof count === 'number' && count > 0) {
            online.add(userIds[i]);
          }
        }
      }
      return online;
    } catch (err) {
      this.logger.error('Presence getOnlineUsers error', err);
      return new Set();
    }
  }

  async getOnlineCount(roomMemberIds: string[]): Promise<number> {
    if (roomMemberIds.length === 0) return 0;

    try {
      const pipeline = this.redis.pipeline();
      for (const uid of roomMemberIds) {
        pipeline.scard(`${PRESENCE_PREFIX}:${uid}`);
      }
      const results = await pipeline.exec();

      let count = 0;
      if (results) {
        for (const [, result] of results) {
          if (typeof result === 'number' && result > 0) {
            count++;
          }
        }
      }
      return count;
    } catch (err) {
      this.logger.error('Presence getOnlineCount error', err);
      return 0;
    }
  }
}
