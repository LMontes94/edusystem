import type {
  ReportConfig,
  PrimaryQualitativeReport,
} from '../../src/modules/reports/report.types';
import { baseStyles } from '../shared/styles';
import { renderHeader } from '../shared/header';
import { renderSignatureBlock } from '../shared/signature-block';

export function primaryQualitativeTemplate(
  data: PrimaryQualitativeReport,
  config: ReportConfig,
): string {
  const { theme } = config;

  const periodHeaders = data.periods.map((p) => `
    <th colspan="3" style="text-align:center;">${p.name.toUpperCase()}</th>
  `).join('');

  const periodSubHeaders = data.periods.map(() => `
    <th style="font-size:9px;">Logrado</th>
    <th style="font-size:9px;">Med. Logrado</th>
    <th style="font-size:9px;">No logrado</th>
  `).join('');

  const valueSymbol = (v: string | null) => {
    if (v === 'achieved')    return '✓';
    if (v === 'in-progress') return '◑';
    if (v === 'not-achieved') return '✗';
    return '';
  };

  const areaRows = data.areas.map((area) => {
    const indicatorRows = area.indicators.map((ind, i) => {
      const periodCells = data.periods.map((p) => {
        const val = ind.valuesByPeriod[p.id] ?? null;
        return `
          <td style="text-align:center;color:${val === 'achieved' ? '#16a34a' : val === 'not-achieved' ? '#dc2626' : '#d97706'};">${val === 'achieved' ? valueSymbol(val) : ''}</td>
          <td style="text-align:center;color:#d97706;">${val === 'in-progress' ? valueSymbol(val) : ''}</td>
          <td style="text-align:center;color:#dc2626;">${val === 'not-achieved' ? valueSymbol(val) : ''}</td>
        `;
      }).join('');

      return `
        <tr>
          ${i === 0 ? `<td rowspan="${area.indicators.length}" style="font-weight:700;background:${theme.primaryColor}20;color:${theme.primaryColor};vertical-align:middle;text-align:center;font-size:10px;">${area.name}</td>` : ''}
          <td style="font-size:10px;">${ind.description}</td>
          ${periodCells}
        </tr>`;
    }).join('');

    return indicatorRows;
  }).join('');

  const observationRows = data.periods.map((p) => `
    <tr>
      <td style="font-weight:700;color:${theme.primaryColor};width:30%;">Observaciones ${p.name}</td>
      <td style="min-height:40px;">${data.observations[p.id] ?? ''}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    ${baseStyles(config)}
    th { font-size: 9px; }
  </style>
</head>
<body>
  ${renderHeader(config, 'Informe de Evaluación Cualitativa')}

  <div class="info-row">
    <span><span class="info-label">Estudiante: </span>${data.student.lastName}, ${data.student.firstName}</span>
    <span><span class="info-label">Curso: </span>${data.course.name}</span>
    <span><span class="info-label">Año: </span>${data.schoolYear}</span>
  </div>
  <div class="info-row">
    <span><span class="info-label">Docente/s: </span>${data.teachers.join(' / ')}</span>
  </div>

  <div class="section-title">Indicadores de evaluación</div>
  <table>
    <thead>
      <tr>
        <th style="width:12%;">Área</th>
        <th style="text-align:left;width:35%;">Indicadores</th>
        ${periodHeaders}
      </tr>
      <tr>
        <th></th><th></th>
        ${periodSubHeaders}
      </tr>
    </thead>
    <tbody>
      ${areaRows}
    </tbody>
  </table>

  <div class="section-title">Observaciones</div>
  <table>
    <tbody>
      ${observationRows}
    </tbody>
  </table>

  <div class="section-title">Asistencia</div>
  <table style="width:auto;">
    <thead>
      <tr>
        <th>Presentes</th><th>Ausentes</th><th>Tardanzas</th><th>Total</th><th>% Asistencia</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:center;">${data.attendance.present}</td>
        <td style="text-align:center;">${data.attendance.absent}</td>
        <td style="text-align:center;">${data.attendance.late}</td>
        <td style="text-align:center;font-weight:700;">${data.attendance.total}</td>
        <td style="text-align:center;font-weight:700;color:${data.attendance.rate >= 75 ? '#16a34a' : '#dc2626'};">${data.attendance.rate}%</td>
      </tr>
    </tbody>
  </table>

  ${renderSignatureBlock()}
</body>
</html>`;
}
