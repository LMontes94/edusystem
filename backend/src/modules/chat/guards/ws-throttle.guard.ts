import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Socket } from 'socket.io';
import { WS_THROTTLE_KEY, WsThrottleConfig } from '../decorators/throttle-ws.decorator';

@Injectable()
export class WsThrottleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  canActivate(context: ExecutionContext): boolean {
    const config = this.reflector.get<WsThrottleConfig | undefined>(
      WS_THROTTLE_KEY,
      context.getHandler(),
    );
    if (!config) return true;

    const client = context.switchToWs().getClient<Socket>();
    const handlerName = context.getHandler().name;
    const key = `${client.id}:${handlerName}`;
    const now = Date.now();

    let window = this.windows.get(key);
    if (!window || now > window.resetAt) {
      window = { count: 0, resetAt: now + config.windowMs };
      this.windows.set(key, window);
    }

    window.count++;
    if (window.count > config.limit) {
      client.emit('throttled', {
        handler: handlerName,
        retryAfterMs: window.resetAt - now,
      });
      return false;
    }

    return true;
  }
}
