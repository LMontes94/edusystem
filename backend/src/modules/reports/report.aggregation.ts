import { computeTrayectoria } from './trayectoria.helper';

export interface PeriodAggregationEntry {
  label: string;
  includePeriodOrder: number[];
}

export interface AggregatedColumn {
  label: string;
  avgScore: number | null;
  trayectoria: 'TEA' | 'TEP' | 'TED' | null;
}

export interface AggregateInput {
  subjectGrades: Map<string, number[]>;
  subjectEvals: Map<string, { value: string }[]>;
}

export const DEFAULT_SECUNDARIA_AGGREGATION: PeriodAggregationEntry[] = [
  { label: '1er Cuat.', includePeriodOrder: [1] },
  { label: '2do Cuat.', includePeriodOrder: [2] },
];

export const DEFAULT_PRIMARIA_AGGREGATION: PeriodAggregationEntry[] = [
  { label: '1er Trim.', includePeriodOrder: [1] },
  { label: '2do Trim.', includePeriodOrder: [2] },
  { label: '3er Trim.', includePeriodOrder: [3] },
];

export const DEFAULT_AGGREGATION: Record<string, PeriodAggregationEntry[]> = {
  SECUNDARIA: DEFAULT_SECUNDARIA_AGGREGATION,
  PRIMARIA:   DEFAULT_PRIMARIA_AGGREGATION,
  INICIAL:    DEFAULT_PRIMARIA_AGGREGATION,
};

export function aggregatePeriods(
  input: AggregateInput,
  sortedPeriods: { id: string; order: number }[],
  aggregation: PeriodAggregationEntry[],
  scoreOverrides?: Map<string, number>,
): AggregatedColumn[] {
  return aggregation.map((entry) => {
    const allScores: number[] = [];
    const allEvals: { value: string }[] = [];

    for (const period of sortedPeriods) {
      if (entry.includePeriodOrder.includes(period.order)) {
        if (scoreOverrides?.has(period.id)) {
          allScores.push(scoreOverrides.get(period.id)!);
        } else {
          const scores = input.subjectGrades.get(period.id);
          if (scores) allScores.push(...scores);
        }

        const evals = input.subjectEvals.get(period.id);
        if (evals) allEvals.push(...evals);
      }
    }

    const avgScore = allScores.length > 0
      ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 100) / 100
      : null;

    const trayectoria = allEvals.length > 0
      ? computeTrayectoria({ indicators: allEvals, strategy: 'MAJORITY' })
      : null;

    return { label: entry.label, avgScore, trayectoria };
  });
}
