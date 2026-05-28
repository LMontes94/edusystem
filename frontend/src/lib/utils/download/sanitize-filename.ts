export function sanitizeFilename(name: string): string {
  let clean = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  clean = clean.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
  clean = clean.replace(/\.{2,}/g, '.');
  clean = clean.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i, '_$1');
  return clean || 'download';
}
