import type { ReportConfig, ValoracionReport } from '../../src/modules/reports/report.types';
import { baseStyles } from '../shared/styles';
import { renderHeader } from '../shared/header';
import { renderStudentInfo } from '../shared/student-info';
import { renderSignatureBlock } from '../shared/signature-block';

export function valoracionesTemplate(data: ValoracionReport, config: ReportConfig): string {
  const subjectBlocks = data.subjects.map((s) => {
    const indicatorRows = s.indicators.map((ind, i) => `
      <tr>
        ${i === 0 ? `<td rowspan="${s.indicators.length}" style="font-weight:700;background:${config.theme.primaryColor}10;color:${config.theme.primaryColor};vertical-align:middle;text-align:center;font-size:8pt;width:14%;">${s.subjectName}</td>` : ''}
        <td style="font-size:8pt;text-align:left;width:52%;">${ind.description}</td>
        <td style="text-align:center;width:10%;">${criterionBadge(ind.value)}</td>
      </tr>
    `).join('');

    const obsHtml = s.observations?.length
      ? `<tr><td colspan="3" style="font-size:7.5pt;color:#555;padding:2pt 6pt;text-align:left;border:none;" class="long-text">${s.observations.map(o => o.text).join('<br>')}</td></tr>`
      : '';

    return `
      <div class="subject-block">
        <table style="margin-bottom:4pt;">
          <thead>
            <tr>
              <th style="width:14%;">Materia</th>
              <th style="width:52%;text-align:left;">Indicador / Criterio</th>
              <th style="width:10%;">Evaluación</th>
            </tr>
          </thead>
          <tbody>
            ${indicatorRows}
            ${obsHtml}
          </tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8pt;font-size:8pt;">
          <span class="info-label">Trayectoria:</span>
          <span class="tealabel ${s.trayectoria}" style="font-size:8pt;">${s.trayectoria}</span>
        </div>
      </div>`;
  }).join('');

  const leyenda = `
    <div style="margin-top:8pt;padding:6pt 8pt;border:0.5pt solid #ccc;background:#f9f9f9;font-size:7.5pt;">
      <strong>Códigos de desempeño:</strong>
      <span style="color:#16a34a;">LFD (Logrado en Forma Destacada)</span> |
      <span style="color:#22c55e;">LS (Logrado Satisfactoriamente)</span> |
      <span style="color:#d97706;">LP (Logrado Parcialmente)</span> |
      <span style="color:#dc2626;">ANL (Aún No Logrado)</span>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Trayectorias:</strong>
      <span style="color:#16a34a;">TEA (Tray. Educ. Avanzada)</span> |
      <span style="color:#d97706;">TEP (Tray. Educ. en Progreso)</span> |
      <span style="color:#dc2626;">TED (Tray. Educ. en Desarrollo)</span>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    ${baseStyles(config)}
    td:first-child { vertical-align: middle; }
  </style>
</head>
<body>
  ${renderHeader(config, 'Informe de Valoración Preliminar')}

  ${renderStudentInfo(data.student, data.course, data.schoolYear)}

  <div class="section-title">Evaluación por indicadores</div>

  ${subjectBlocks}
  ${leyenda}

  ${renderSignatureBlock()}
</body>
</html>`;
}

function criterionBadge(value: string): string {
  const colors: Record<string, string> = {
    LFD: '#16a34a',
    LS: '#22c55e',
    LP: '#d97706',
    ANL: '#dc2626',
  };
  const bgColors: Record<string, string> = {
    LFD: '#f0fdf4',
    LS: '#f0fdf4',
    LP: '#fffbeb',
    ANL: '#fef2f2',
  };
  const color = colors[value] ?? '#666';
  const bg = bgColors[value] ?? '#f5f5f5';
  return `<span style="display:inline-block;padding:1pt 5pt;border-radius:2pt;font-weight:700;font-size:8pt;color:${color};background:${bg};">${value}</span>`;
}
