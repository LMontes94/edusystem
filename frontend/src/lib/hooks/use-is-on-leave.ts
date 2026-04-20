// Hook que devuelve true si el usuario actual
// está en licencia. Usarlo para deshabilitar
// botones de guardado en los componentes.
//
// Uso:
//   const isOnLeave = useIsOnLeave();
//   <Button disabled={isOnLeave || isPending}>Guardar</Button>
// ─────────────────────────────────────────────
 
import { useSession } from 'next-auth/react';
 
export function useIsOnLeave(): boolean {
  const { data: session } = useSession();
  return (session?.user as any)?.status === 'ON_LEAVE';
}