import type { ReportConfig } from '../../src/modules/reports/report.types';

export function baseStyles(config: ReportConfig): string {
  const { theme } = config;
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: ${theme.textColor}; }
    @page { margin: 15mm 12mm; size: A4; }
    @media print {
      .page-break { page-break-before: always; }
      thead { display: table-header-group; }
      .no-break { page-break-inside: avoid; }
    }
    table { width: 100%; border-collapse: collapse; }
    td, th { vertical-align: top; }
    th { background: ${theme.primaryColor}; color: white; padding: 4pt 3pt; font-size: 8pt; text-align: center; border: 0.5pt solid ${theme.primaryColor}; }
    td { padding: 3pt; border: 0.5pt solid #ccc; font-size: 8pt; }
    .subject-block { break-inside: avoid; page-break-inside: avoid; }
    .long-text { white-space: pre-wrap; word-break: break-word; }
    .info-row { display: flex; gap: 20px; margin: 10px 0; font-size: 9pt; flex-wrap: wrap; }
    .info-label { font-weight: 700; color: ${theme.primaryColor}; }
    .section-title { font-size: 10pt; font-weight: 700; color: ${theme.secondaryColor}; margin: 12px 0 4px; border-bottom: 1px solid ${theme.secondaryColor}; padding-bottom: 2px; }
    .tealabel { font-weight: 700; font-size: 7.5pt; padding: 1pt 4pt; border-radius: 2pt; display: inline-block; }
    .tealabel.TEA { color: #16a34a; background: #f0fdf4; }
    .tealabel.TEP { color: #d97706; background: #fffbeb; }
    .tealabel.TED { color: #dc2626; background: #fef2f2; }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .fw-bold { font-weight: 700; }
    .score-high { color: #16a34a; font-weight: 700; }
    .score-mid  { color: #d97706; font-weight: 700; }
    .score-low  { color: #dc2626; font-weight: 700; }
  `;
}
