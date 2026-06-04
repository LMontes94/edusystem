export const LEVEL_ENUM_TO_SLUG: Record<string, string> = {
  INICIAL: 'inicial',
  PRIMARIA: 'primaria',
  SECUNDARIA: 'secundaria',
};

export const LEVEL_SLUG_TO_NAME: Record<string, string> = {
  inicial: 'Inicial',
  primaria: 'Primaria',
  secundaria: 'Secundaria',
};

export const LEVEL_ENUM_TO_NAME: Record<string, string> = {
  INICIAL: 'Inicial',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
};

export function levelEnumToSlug(level: string): string {
  return LEVEL_ENUM_TO_SLUG[level] ?? level.toLowerCase();
}

export function intToOrdinal(n: number): string {
  const map: Record<number, string> = {
    1: '1ro', 2: '2do', 3: '3ro', 4: '4to',
    5: '5to', 6: '6to', 7: '7mo', 8: '8vo',
    9: '9no', 10: '10mo', 11: '11mo', 12: '12mo',
  };
  return map[n] ?? `${n}to`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function generateCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  }
  return lines.join('\n');
}
