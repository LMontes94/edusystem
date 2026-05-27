import type {
  ReportConfig,
  SecondaryGradeReport,
} from '../src/modules/reports/report.types';
import { baseStyles } from './shared/styles';
import { renderHeader } from './shared/header';
import { renderStudentInfo } from './shared/student-info';
import { renderSignatureBlock } from './shared/signature-block';
export { baseStyles, renderHeader, renderStudentInfo, renderSignatureBlock };

export { riteTemplate } from './secondary/rite.template';
export { valoracionesTemplate } from './secondary/valoraciones.template';
export { primaryQualitativeTemplate } from './primary/qualitative.template';


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
    ${baseStyles(config)}
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
