import { ReportConfig } from '../src/modules/reports/report.types';

interface ConvivenciasData {
  student:      { firstName: string; lastName: string; documentNumber: string };
  course:       { name: string; grade: number; division: string };
  convivencias: { date: string; reason: string; type: string; author: string }[];
}

const typeLabels: Record<string, string> = {
  observation:    'Observación',
  warning:        'Advertencia',
  reprimand:      'Apercibimiento',
  commendation:   'Felicitación',
  suspension:     'Suspensión',
  parent_meeting: 'Citación de padres',
};

export function convivenciasTemplate(data: ConvivenciasData, config: ReportConfig): string {
  const { theme } = config;

  const rows = data.convivencias.map((c, i) => `
    <tr style="background:${i % 2 === 0 ? '#f9f9f9' : 'white'};">
      <td style="border:1px solid #ddd;padding:8px;font-size:10px;">
        ${new Date(c.date).toLocaleDateString('es-AR')}
      </td>
      <td style="border:1px solid #ddd;padding:8px;font-size:10px;">${c.reason}</td>
      <td style="border:1px solid #ddd;padding:8px;font-size:10px;">${c.author}</td>
      <td style="border:1px solid #ddd;padding:8px;font-size:10px;font-weight:600;">
        ${typeLabels[c.type] ?? c.type}
      </td>
    </tr>
  `).join('');

  const logoHtml = config.logoUrl
    ? `<img src="${config.logoUrl}" alt="Escudo" style="height:70px;object-fit:contain;">`
    : `<div style="width:70px;height:70px;border:2px solid ${theme.primaryColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:${theme.primaryColor};">${config.institutionName.charAt(0)}</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size:11px; color:#1a1a1a; padding:20px 30px; }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;border-bottom:3px solid ${theme.primaryColor};padding-bottom:16px;">
    ${config.logoPosition !== 'none' ? logoHtml : ''}
    <div>
      <div style="font-size:20px;font-weight:700;color:${theme.primaryColor};">
        ${config.institutionName.toUpperCase()}
      </div>
      <div style="font-size:13px;color:${theme.secondaryColor};margin-top:4px;">
        Registro de Convivencia Escolar
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;font-size:11px;">
    <div><strong style="color:${theme.primaryColor};">Estudiante: </strong>${data.student.lastName}, ${data.student.firstName}</div>
    <div><strong style="color:${theme.primaryColor};">DNI: </strong>${data.student.documentNumber}</div>
    <div><strong style="color:${theme.primaryColor};">Curso: </strong>${data.course.name}</div>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-top:10px;">
    <thead>
      <tr>
        <th style="background:${theme.primaryColor};color:white;padding:8px;font-size:10px;text-align:left;width:12%;">Fecha</th>
        <th style="background:${theme.primaryColor};color:white;padding:8px;font-size:10px;text-align:left;width:40%;">Motivo</th>
        <th style="background:${theme.primaryColor};color:white;padding:8px;font-size:10px;text-align:left;width:25%;">Solicitante</th>
        <th style="background:${theme.primaryColor};color:white;padding:8px;font-size:10px;text-align:left;width:23%;">Medida tomada</th>
      </tr>
    </thead>
    <tbody>
      ${rows.length > 0 ? rows : `
        <tr>
          <td colspan="4" style="border:1px solid #ddd;padding:16px;text-align:center;color:#666;">
            Sin registros de convivencia
          </td>
        </tr>
      `}
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