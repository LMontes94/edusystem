import type { ReportConfig } from '../../src/modules/reports/report.types';

export function renderHeader(config: ReportConfig, subtitle: string): string {
  const { theme, logoPosition, layout, institutionName, logoUrl } = config;

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="" style="height:70px;object-fit:contain;">`
    : `<div style="width:70px;height:70px;border:2px solid ${theme.primaryColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:${theme.primaryColor};">${institutionName.charAt(0)}</div>`;

  if (layout === 'modern') {
    return `
      <div style="background:${theme.primaryColor};color:white;padding:16px 24px;display:flex;align-items:center;gap:16px;">
        ${logoPosition === 'left' ? logoHtml : ''}
        <div style="${logoPosition === 'center' ? 'text-align:center;flex:1;' : 'flex:1;'}">
          <div style="font-size:18px;font-weight:700;letter-spacing:1px;">${institutionName.toUpperCase()}</div>
          <div style="font-size:11px;opacity:0.9;margin-top:2px;">${subtitle}</div>
        </div>
        ${logoPosition === 'center' ? logoHtml : ''}
      </div>`;
  }

  if (layout === 'institutional') {
    return `
      <div style="text-align:center;padding:20px 24px 12px;border-bottom:2px solid ${theme.primaryColor};">
        ${logoHtml}
        <div style="font-size:20px;font-weight:700;color:${theme.primaryColor};margin-top:8px;letter-spacing:1px;">${institutionName.toUpperCase()}</div>
        <div style="font-size:12px;color:${theme.secondaryColor};margin-top:2px;">${subtitle}</div>
      </div>`;
  }

  return `
    <div style="border-bottom:2px solid ${theme.primaryColor};padding-bottom:12px;margin-bottom:12px;">
      <div style="display:flex;flex-direction:${logoPosition === 'center' ? 'column' : 'row'};align-items:center;gap:${logoPosition === 'center' ? '6px' : '16px'};${logoPosition === 'center' ? 'text-align:center;' : ''}">
        ${logoPosition !== 'none' ? `<div>${logoHtml}</div>` : ''}
        <div>
          <div style="font-size:18px;font-weight:700;color:${theme.primaryColor};">${institutionName.toUpperCase()}</div>
          <div style="font-size:11px;color:${theme.secondaryColor};margin-top:2px;">${subtitle}</div>
        </div>
      </div>
    </div>`;
}
