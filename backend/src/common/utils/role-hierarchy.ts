export const ROLE_HIERARCHY: string[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'DIRECTOR',
  'SECRETARY',
  'PRECEPTOR',
  'TEACHER',
  'GUARDIAN',
];
 
/**
 * Dado un array de roles, devuelve el de mayor jerarquía.
 * Ej: ['TEACHER', 'PRECEPTOR'] → 'PRECEPTOR'
 */
export function getHighestRole(roles: string[]): string {
  if (roles.length === 0) return 'GUARDIAN';
 
  return roles.reduce((highest, current) => {
    const highestIdx = ROLE_HIERARCHY.indexOf(highest);
    const currentIdx = ROLE_HIERARCHY.indexOf(current);
    // Menor índice = mayor jerarquía
    return currentIdx < highestIdx ? current : highest;
  });
}