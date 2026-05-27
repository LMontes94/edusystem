import type { TrayectoriaStrategy } from './report.types';

interface TrayectoriaInput {
  indicators: { value: string }[];
  strategy: TrayectoriaStrategy;
  weights?: { LFD: number; LS: number; LP: number; ANL: number };
}

type TrayectoriaResult = 'TEA' | 'TEP' | 'TED';

const VALID_VALUES = new Set(['LFD', 'LS', 'LP', 'ANL']);

function countByValue(indicators: { value: string }[]): { LFD: number; LS: number; LP: number; ANL: number } {
  const counts = { LFD: 0, LS: 0, LP: 0, ANL: 0 };
  for (const ind of indicators) {
    if (VALID_VALUES.has(ind.value)) {
      counts[ind.value as keyof typeof counts]++;
    }
  }
  return counts;
}

function majorityStrategy(indicators: { value: string }[]): TrayectoriaResult {
  const { LFD, LS, LP, ANL } = countByValue(indicators);
  const total = LFD + LS + LP + ANL;
  if (total === 0) return 'TED';

  const positive = LFD + LS;
  if (positive >= LP + ANL) return 'TEA';
  if (LP >= ANL) return 'TEP';
  return 'TED';
}

function strictStrategy(indicators: { value: string }[]): TrayectoriaResult {
  const { LFD, LS, LP, ANL } = countByValue(indicators);
  const total = LFD + LS + LP + ANL;
  if (total === 0) return 'TED';

  if (ANL > 0) return 'TED';
  if (LP >= LS + LFD) return 'TEP';
  if (LS + LFD > LP) return 'TEA';
  return 'TED';
}

function weightedStrategy(
  indicators: { value: string }[],
  weights: { LFD: number; LS: number; LP: number; ANL: number },
): TrayectoriaResult {
  const counts = countByValue(indicators);
  const total = counts.LFD + counts.LS + counts.LP + counts.ANL;
  if (total === 0) return 'TED';

  const sum = counts.LFD * weights.LFD + counts.LS * weights.LS + counts.LP * weights.LP + counts.ANL * weights.ANL;
  const maxScore = total * weights.LFD;
  const minScore = total * weights.ANL;
  const normalized = (sum - minScore) / (maxScore - minScore);

  if (normalized >= 0.66) return 'TEA';
  if (normalized >= 0.33) return 'TEP';
  return 'TED';
}

export function computeTrayectoria(input: TrayectoriaInput): TrayectoriaResult {
  switch (input.strategy) {
    case 'MAJORITY':
      return majorityStrategy(input.indicators);
    case 'STRICT':
      return strictStrategy(input.indicators);
    case 'WEIGHTED':
      return weightedStrategy(input.indicators, input.weights ?? { LFD: 4, LS: 3, LP: 2, ANL: 1 });
    case 'CUSTOM':
      return majorityStrategy(input.indicators);
    default:
      return majorityStrategy(input.indicators);
  }
}
