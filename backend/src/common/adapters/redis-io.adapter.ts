import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { ServerOptions } from 'socket.io';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(url: string): Promise<void> {
    const pubClient = createClient({ url });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    pubClient.on('error', (err) => {
      console.error('Redis pub client error:', err);
    });
    subClient.on('error', (err) => {
      console.error('Redis sub client error:', err);
    });

    pubClient.on('reconnecting', () => {
      console.log('Redis pub client reconnecting...');
    });
    subClient.on('reconnecting', () => {
      console.log('Redis sub client reconnecting...');
    });

    pubClient.on('ready', () => {
      console.log('Redis pub client connected');
    });
    subClient.on('ready', () => {
      console.log('Redis sub client connected');
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
