import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(url: string): Promise<void> {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    pubClient.on('error', (err) => {
      this.logger.error('Redis pub client error', err);
    });
    subClient.on('error', (err) => {
      this.logger.error('Redis sub client error', err);
    });

    pubClient.on('reconnecting', () => {
      this.logger.warn('Redis pub client reconnecting...');
    });
    subClient.on('reconnecting', () => {
      this.logger.warn('Redis sub client reconnecting...');
    });

    pubClient.on('ready', () => {
      this.logger.log('Redis pub client connected');
    });
    subClient.on('ready', () => {
      this.logger.log('Redis sub client connected');
    });

    pubClient.on('end', () => {
      this.logger.warn('Redis pub client connection closed');
    });
    subClient.on('end', () => {
      this.logger.warn('Redis sub client connection closed');
    });

    this.adapterConstructor = createAdapter(pubClient, subClient, {
      key: 'edusystem:chat',
    });
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim());

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: allowedOrigins,
        credentials: true,
      },
    });
    server.adapter(this.adapterConstructor);
    return server;
  }
}
