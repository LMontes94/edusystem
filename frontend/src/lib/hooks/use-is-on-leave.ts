// src/lib/hooks/use-is-on-leave.ts
import { useAppSession } from '@/lib/hooks/use-app-session';

export function useIsOnLeave(): boolean {
  const { data: session } = useAppSession();
  return (session?.user as any)?.status === 'ON_LEAVE';
}