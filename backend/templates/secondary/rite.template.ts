import type { ReportConfig, RiteReport } from '../../src/modules/reports/report.types';
import { baseStyles } from '../shared/styles';
import { renderHeader } from '../shared/header';
import { renderStudentInfo } from '../shared/student-info';
import { renderSignatureBlock } from '../shared/signature-block';

export function riteTemplate(data: RiteReport, config: ReportConfig): string {
  const { theme } = config;

  const trayectoriaLabel = (val: string | null) => {
    if (!val) return '<span style="color:#999;">—</span>';
    const color = val === 'TEA' ? '#16a34a' : val === 'TEP' ? '#d97706' : '#dc2626';
    return `<span class="tealabel ${val}" style="color:${color};">${val}</span>`;
  };

  const scoreSpan = (val: number | null) => {
    if (val === null) return '<span style="color:#999;">—</span>';
    const color = val >= 7 ? '#16a34a' : val >= 4 ? '#d97706' : '#dc2626';
    return `<span style="font-weight:700;color:${color};">${val.toFixed(1)}</span>`;
  };

  const subjectRows = data.subjects.map((s) => `
    <tr class="no-break">
      <td style="text-align:center;font-size:7.5pt;">${s.cursada}</td>
      <td style="font-weight:500;text-align:left;">${s.subjectName}<br><span style="font-size:7pt;color:#888;">${s.code}</span></td>
      <td style="text-align:center;">${trayectoriaLabel(s.preliminary1)}</td>
      <td style="text-align:center;">${scoreSpan(s.grade1)}</td>
      <td style="text-align:center;">${trayectoriaLabel(s.preliminary2)}</td>
      <td style="text-align:center;">${scoreSpan(s.grade2)}</td>
      <td style="text-align:center;font-size:7.5pt;">${s.intensificacionDec ?? '—'}</td>
      <td style="text-align:center;font-size:7.5pt;">${s.intensificacionFeb ?? '—'}</td>
      <td style="text-align:center;">${scoreSpan(s.finalGrade)}</td>
      <td style="font-size:7.5pt;text-align:left;max-width:90px;" class="long-text">${renderObservations(s.observations)}</td>
    </tr>
  `).join('');

  const formatAttendanceBlock = (label: string, att: { present: number; absent: number; late: number; justified: number; total: number; rate: number }) => `
    <tr>
      <td style="font-weight:700;">${label}</td>
      <td style="text-align:center;">${att.present}</td>
      <td style="text-align:center;">${att.absent}</td>
      <td style="text-align:center;">${att.late}</td>
      <td style="text-align:center;">${att.justified}</td>
      <td style="text-align:center;font-weight:700;">${att.total}</td>
      <td style="text-align:center;font-weight:700;color:${att.rate >= 75 ? '#16a34a' : '#dc2626'};">${att.rate}%</td>
    </tr>`;

  const convivenciaRows = data.convivencias.map((c) => `
    <tr>
      <td style="text-align:center;">${c.date}</td>
      <td style="text-align:center;"><span style="font-weight:700;color:${c.type === 'APERCIBIMIENTO' ? '#dc2626' : '#d97706'};">${c.type}</span></td>
      <td class="long-text">${c.description}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    ${baseStyles(config)}
    table.rite th { font-size: 7pt; padding: 3pt 2pt; }
    table.rite td { font-size: 7.5pt; padding: 2pt; }
    table.attendance { width: auto; }
    table.attendance th, table.attendance td { padding: 3pt 8pt; font-size: 8pt; text-align: center; }
    table.convivencias th, table.convivencias td { padding: 4pt 6pt; font-size: 8pt; }
    table.convivencias td:last-child { max-width: 200px; }
  </style>
</head>
<body>
  ${renderHeader(config, 'Registro Institucional de Trayectorias Educativas (RITE)')}

  ${renderStudentInfo(data.student, data.course, data.schoolYear)}

  <div class="section-title">Trayectoria académica</div>
  <table class="rite">
    <thead>
      <tr>
        <th style="width:3%;">C/R</th>
        <th style="width:20%;text-align:left;">Materia</th>
        <th style="width:8%;">1ra Val.<br>Prelim.</th>
        <th style="width:7%;">1er<br>Cuat.</th>
        <th style="width:8%;">2da Val.<br>Prelim.</th>
        <th style="width:7%;">2do<br>Cuat.</th>
        <th style="width:7%;">Int.<br>Dic</th>
        <th style="width:7%;">Int.<br>Feb</th>
        <th style="width:7%;">Calif.<br>Final</th>
        <th style="width:20%;text-align:left;">Observaciones</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
    </tbody>
  </table>

  <div class="section-title">Asistencia</div>
  <table class="attendance">
    <thead>
      <tr>
        <th></th>
        <th>Presentes</th>
        <th>Ausentes</th>
        <th>Tardanzas</th>
        <th>Justificadas</th>
        <th>Total días</th>
        <th>% Asistencia</th>
      </tr>
    </thead>
    <tbody>
      ${formatAttendanceBlock('1er Cuatrimestre', data.attendance.firstC)}
      ${formatAttendanceBlock('2do Cuatrimestre', data.attendance.secondC)}
      ${formatAttendanceBlock('Total', data.attendance.total)}
    </tbody>
  </table>

  ${convivenciaRows ? `
  <div class="section-title">Registro de Convivencia</div>
  <table class="convivencias">
    <thead>
      <tr>
        <th style="width:15%;">Fecha</th>
        <th style="width:18%;">Tipo</th>
        <th style="text-align:left;">Descripción</th>
      </tr>
    </thead>
    <tbody>
      ${convivenciaRows}
    </tbody>
  </table>` : ''}

  ${renderSignatureBlock()}
</body>
</html>`;
}

function renderObservations(observations?: { type: string; text: string }[]): string {
  if (!observations || observations.length === 0) return '—';
  return observations.map((o) => `<div>${o.text}</div>`).join('');
}
