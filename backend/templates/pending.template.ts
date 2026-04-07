// src/modules/reports/templates/pending.template.ts
import { ReportConfig } from '../src/modules/reports/report.types';

interface PendingSubjectData {
  student: {
    firstName:      string;
    lastName:       string;
    documentNumber: string;
  };
  course: {
    name:     string;
    grade:    number;
    division: string;
    level:    string;
  };
  schoolYear: number;
  institution: {
    name:     string;
    district?: string;
  };
  pendings: {
    subjectName:    string;
    initialSabers?: string;
    march?:         string;
    august?:        string;
    november?:      string;
    december?:      string;
    february?:      string;
    finalScore?:    string;
    closingSabers?: string;
  }[];
}

export function pendingSubjectsTemplate(
  data: PendingSubjectData,
  config: ReportConfig,
): string {
  const { theme } = config;

  const pendingRows = data.pendings.map((p, i) => `
    <tr style="height:60px;">
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;vertical-align:top;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${i + 1}.
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;vertical-align:top;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.subjectName}
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;vertical-align:top;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.initialSabers ?? ''}
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;text-align:center;vertical-align:middle;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.march ?? ''}
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;text-align:center;vertical-align:middle;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.august ?? ''}
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;text-align:center;vertical-align:middle;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.november ?? ''}
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;text-align:center;vertical-align:middle;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.december ?? ''}
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;text-align:center;vertical-align:middle;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.february ?? ''}
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;text-align:center;vertical-align:middle;font-weight:700;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.finalScore ?? ''}
      </td>
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;vertical-align:top;background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${p.closingSabers ?? ''}
      </td>
    </tr>
  `).join('');

  // Completar con filas vacías hasta 6
  const emptyRows = Math.max(0, 6 - data.pendings.length);
  const emptyRowsHtml = Array.from({ length: emptyRows }, (_, i) => `
    <tr style="height:60px;">
      <td style="border:1px solid #ccc;padding:6px;font-size:10px;background:${(data.pendings.length + i) % 2 === 0 ? '#f9f9f9' : 'white'};">
        ${data.pendings.length + i + 1}.
      </td>
      <td style="border:1px solid #ccc;" colspan="9"></td>
    </tr>
  `).join('');

  const logoHtml = config.logoUrl
    ? `<img src="${config.logoUrl}" alt="Escudo" style="height:60px;object-fit:contain;">`
    : `<div style="width:60px;height:60px;border:2px solid ${theme.primaryColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:${theme.primaryColor};">${config.institutionName.charAt(0)}</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size:11px; color:#1a1a1a; padding:15px 20px; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
    <div style="flex:1;">
      <div style="font-size:14px;font-weight:700;color:${theme.primaryColor};">
        REGISTRO INSTITUCIONAL DE TRAYECTORIAS EDUCATIVAS
      </div>
      <div style="font-size:11px;color:${theme.secondaryColor};margin-top:2px;">
        NIVEL DE EDUCACIÓN SECUNDARIA
      </div>
    </div>
    ${config.logoPosition !== 'none' ? logoHtml : ''}
  </div>

  <!-- Info institución -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px;font-size:10px;">
    <div><strong>ESCUELA:</strong> ${data.institution.name.toUpperCase()}</div>
    <div><strong>DISTRITO:</strong> ${data.institution.district ?? '—'}</div>
    <div><strong>CICLO LECTIVO:</strong> ${data.schoolYear}</div>
    <div><strong>AÑO:</strong> ${data.course.grade}°</div>
    <div><strong>ESTUDIANTE:</strong> ${data.student.lastName}, ${data.student.firstName}</div>
    <div><strong>SECCIÓN:</strong> ${data.course.division}</div>
  </div>

  <!-- Título tabla -->
  <div style="background:${theme.primaryColor};color:white;text-align:center;padding:6px;font-size:11px;font-weight:700;margin-bottom:0;">
    MATERIAS PENDIENTES DE APROBACIÓN Y ACREDITACIÓN - INTENSIFICACIÓN
  </div>

  <!-- Tabla principal -->
  <table style="width:100%;margin-bottom:12px;">
    <thead>
      <tr>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;width:3%;"></th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;width:18%;text-align:center;">MATERIAS</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;width:18%;text-align:center;">SABERES INICIALES PENDIENTES DE APROBACIÓN AL INICIO DEL CICLO LECTIVO</th>
        <th colspan="5" style="border:1px solid #ccc;background:${theme.secondaryColor};color:white;padding:5px;font-size:9px;text-align:center;width:32%;">PERÍODOS DE INTENSIFICACIÓN</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;width:8%;text-align:center;">CALIFICACIÓN FINAL</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;width:15%;text-align:center;">SABERES PENDIENTES DE APROBACIÓN AL CIERRE DEL CICLO LECTIVO</th>
      </tr>
      <tr>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;width:3%;"></th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;width:18%;"></th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;width:18%;"></th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;text-align:center;writing-mode:vertical-lr;transform:rotate(180deg);height:50px;width:6%;">MARZO</th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;text-align:center;writing-mode:vertical-lr;transform:rotate(180deg);height:50px;width:6%;">AGOSTO</th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;text-align:center;writing-mode:vertical-lr;transform:rotate(180deg);height:50px;width:7%;">NOVIEMBRE</th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;text-align:center;writing-mode:vertical-lr;transform:rotate(180deg);height:50px;width:7%;">DICIEMBRE</th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;text-align:center;writing-mode:vertical-lr;transform:rotate(180deg);height:50px;width:6%;">FEBRERO</th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;width:8%;"></th>
        <th style="border:1px solid #ccc;background:#e8e8e8;padding:2px;font-size:7px;width:15%;"></th>
      </tr>
    </thead>
    <tbody>
      ${pendingRows}
      ${emptyRowsHtml}
    </tbody>
  </table>

  <!-- Notas -->
  <div style="font-size:9px;margin-bottom:12px;">
    <strong>NOTAS</strong><br>
    Aprobó y Acreditó (AA), Continúa Con Avances (CCA), Continúa Sin Avances (CSA)<br>
    Materias aprobadas y acreditadas calificación final 4
  </div>

  <!-- Tabla de notificaciones -->
  <table style="width:100%;margin-bottom:20px;">
    <thead>
      <tr>
        <th colspan="2" style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;text-align:center;">NOTIFICACIONES</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;text-align:center;">MARZO</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;text-align:center;">AGOSTO</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;text-align:center;">NOVIEMBRE</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;text-align:center;">DICIEMBRE</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;text-align:center;">FEBRERO</th>
        <th style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;text-align:center;">CALIFICACIÓN FINAL</th>
      </tr>
    </thead>
    <tbody>
      <tr style="height:30px;">
        <td colspan="2" style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;font-weight:700;">FECHA</td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
      </tr>
      <tr style="height:40px;">
        <td rowspan="3" style="border:1px solid #ccc;background:${theme.primaryColor};color:white;padding:5px;font-size:9px;font-weight:700;vertical-align:middle;text-align:center;">FIRMA DE</td>
        <td style="border:1px solid #ccc;background:${theme.secondaryColor};color:white;padding:5px;font-size:9px;">DIRECTORA/OR</td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
      </tr>
      <tr style="height:40px;">
        <td style="border:1px solid #ccc;background:${theme.secondaryColor};color:white;padding:5px;font-size:9px;">ADULTA/O RESPONSABLE</td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
      </tr>
      <tr style="height:40px;">
        <td style="border:1px solid #ccc;background:${theme.secondaryColor};color:white;padding:5px;font-size:9px;">ESTUDIANTE</td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
        <td style="border:1px solid #ccc;"></td>
      </tr>
    </tbody>
  </table>

</body>
</html>`;
}