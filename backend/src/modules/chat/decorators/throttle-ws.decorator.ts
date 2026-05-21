import { SetMetadata } from '@nestjs/common';

export interface WsThrottleConfig {
  limit: number;
  windowMs: number;
}

export const WS_THROTTLE_KEY = 'ws_throttle';

export const ThrottleWs = (limit: number, windowMs: number) =>
  SetMetadata(WS_THROTTLE_KEY, { limit, windowMs } satisfies WsThrottleConfig);
