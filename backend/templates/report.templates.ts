// src/modules/reports/templates/report.templates.ts
import {
  ReportConfig,
  SecondaryGradeReport,
  PrimaryQualitativeReport,
} from '../src/modules/reports/report.types';

// ── Header compartido ─────────────────────────
function renderHeader(config: ReportConfig, subtitle: string): string {
  const { theme, logoPosition, layout, institutionName, logoUrl } = config;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="Escudo" style="height:80px;object-fit:contain;">`
    : `<div style="width:80px;height:80px;border:2px solid ${theme.primaryColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:${theme.primaryColor};">${institutionName.charAt(0)}</div>`;

  if (layout === 'modern') {
    return `
      <div style="background:${theme.primaryColor};color:white;padding:20px 30px;display:flex;align-items:center;gap:20px;">
        ${logoPosition === 'left' ? logoHtml : ''}
        <div style="${logoPosition === 'center' ? 'text-align:center;flex:1;' : 'flex:1;'}">
          <div style="font-size:22px;font-weight:700;letter-spacing:1px;">${institutionName.toUpperCase()}</div>
          <div style="font-size:13px;opacity:0.9;margin-top:4px;">${subtitle}</div>
        </div>
        ${logoPosition === 'center' ? logoHtml : ''}
      </div>`;
  }

  if (layout === 'institutional') {
    return `
      <div style="text-align:center;padding:24px 30px 16px;border-bottom:3px solid ${theme.primaryColor};">
        ${logoHtml}
        <div style="font-size:24px;font-weight:700;color:${theme.primaryColor};margin-top:12px;letter-spacing:1px;">${institutionName.toUpperCase()}</div>
        <div style="font-size:14px;color:${theme.secondaryColor};margin-top:4px;">${subtitle}</div>
      </div>`;
  }

  // classic
return `
  <div style="border-bottom:3px solid ${theme.primaryColor};padding-bottom:16px;margin-bottom:16px;">
    <div style="display:flex;flex-direction:${logoPosition === 'center' ? 'column' : 'row'};align-items:center;gap:${logoPosition === 'center' ? '8px' : '20px'};${logoPosition === 'center' ? 'text-align:center;' : ''}">
      ${logoPosition === 'left' ? `<div>${logoHtml}</div>` : ''}
      ${logoPosition === 'center' ? `<div>${logoHtml}</div>` : ''}
      <div>
        <div style="font-size:20px;font-weight:700;color:${theme.primaryColor};">${institutionName.toUpperCase()}</div>
        <div style="font-size:13px;color:${theme.secondaryColor};margin-top:2px;">${subtitle}</div>
      </div>
    </div>
  </div>`;
}

// ── CSS base compartido ───────────────────────
function baseStyles(theme: ReportConfig['theme']): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: ${theme.textColor}; padding: 20px 30px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: ${theme.primaryColor}; color: white; padding: 6px 8px; font-size: 10px; text-align: center; }
    td { padding: 5px 8px; border: 1px solid #ddd; font-size: 10px; }
    tr:nth-child(even) td { background: #f5f5f5; }
    .info-row { display: flex; gap: 20px; margin: 12px 0; font-size: 11px; }
    .info-label { font-weight: 700; color: ${theme.primaryColor}; }
    .section-title { font-size: 12px; font-weight: 700; color: ${theme.secondaryColor}; margin: 14px 0 6px; border-bottom: 1px solid ${theme.secondaryColor}; padding-bottom: 3px; }
  `;
}

// ── Template: Boletín Secundaria ──────────────
export function secondaryGradesTemplate(
  data: SecondaryGradeReport,
  config: ReportConfig,
): string {
  const { theme } = config;

  const periodsHeaders = data.periods
    .sort((a, b) => a.order - b.order)
    .map((p) => `<th>${p.name}</th>`)
    .join('');

  const subjectRows = data.subjects.map((subject) => {
    const periodCells = data.periods
      .sort((a, b) => a.order - b.order)
      .map((p) => {
        const grades = subject.gradesByPeriod[p.id] ?? [];
        if (grades.length === 0) return '<td style="text-align:center;">—</td>';
        const avg = grades.reduce((s, g) => s + (g.score ?? 0), 0) / grades.length;
        const color = avg >= 7 ? '#16a34a' : avg >= 4 ? '#d97706' : '#dc2626';
        return `<td style="text-align:center;font-weight:700;color:${color};">${avg.toFixed(1)}</td>`;
      })
      .join('');

    const finalColor = subject.average !== null
      ? subject.average >= 7 ? '#16a34a' : subject.average >= 4 ? '#d97706' : '#dc2626'
      : '#666';

    return `
      <tr>
        <td style="font-weight:500;">${subject.name}</td>
        <td style="text-align:center;font-size:9px;color:#666;">${subject.code}</td>
        ${periodCells}
        <td style="text-align:center;font-weight:700;color:${finalColor};">
          ${subject.average !== null ? subject.average.toFixed(1) : '—'}
        </td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    ${baseStyles(theme)}
    .score-high { color: #16a34a; font-weight: 700; }
    .score-mid  { color: #d97706; font-weight: 700; }
    .score-low  { color: #dc2626; font-weight: 700; }
  </style>
</head>
<body>
  ${renderHeader(config, 'Boletín de Calificaciones')}

  <div class="info-row">
    <span><span class="info-label">Estudiante: </span>${data.student.lastName}, ${data.student.firstName}</span>
    <span><span class="info-label">Curso: </span>${data.course.name}</span>
    <span><span class="info-label">Ciclo lectivo: </span>${data.schoolYear}</span>
    <span><span class="info-label">DNI: </span>${data.student.documentNumber}</span>
  </div>

  <div class="section-title">Calificaciones</div>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;width:35%;">Materia</th>
        <th style="width:8%;">Código</th>
        ${periodsHeaders}
        <th>Promedio final</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
    </tbody>
  </table>

  <div class="section-title">Asistencia</div>
  <table style="width:auto;">
    <thead>
      <tr>
        <th>Presentes</th>
        <th>Ausentes</th>
        <th>Tardanzas</th>
        <th>Justificadas</th>
        <th>Total días</th>
        <th>% Asistencia</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:center;">${data.attendance.present}</td>
        <td style="text-align:center;">${data.attendance.absent}</td>
        <td style="text-align:center;">${data.attendance.late}</td>
        <td style="text-align:center;">${data.attendance.justified}</td>
        <td style="text-align:center;font-weight:700;">${data.attendance.total}</td>
        <td style="text-align:center;font-weight:700;color:${data.attendance.rate >= 75 ? '#16a34a' : '#dc2626'};">${data.attendance.rate}%</td>
      </tr>
    </tbody>
  </table>

  <div style="margin-top:40px;display:flex;gap:40px;">
    <div style="flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#666;">Firma Director/a</div>
    <div style="flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#666;">Firma Adulto Responsable</div>
    <div style="flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#666;">Firma Estudiante</div>
  </div>
</body>
</html>`;
}

// ── Template: Informe Cualitativo Primaria ────
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
    ${baseStyles(theme)}
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

  <div style="margin-top:40px;display:flex;gap:40px;">
    <div style="flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#666;">Firma Director/a</div>
    <div style="flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#666;">Firma Adulto Responsable</div>
    <div style="flex:1;border-top:1px solid #333;padding-top:6px;text-align:center;font-size:10px;color:#666;">Firma Estudiante</div>
  </div>
</body>
</html>`;
}