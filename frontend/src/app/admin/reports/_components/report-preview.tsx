'use client';

import { useState }       from 'react';
import { Button }         from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportSettings } from './reports.types';

interface Props {
  settings: ReportSettings;
}

// ── Header según layout ───────────────────────
function PreviewHeader({ settings }: { settings: ReportSettings }) {
  const Logo = () => (
    <div style={{
      width: 70, height: 70, borderRadius: '50%',
      border: `2px solid ${settings.layout === 'modern' ? 'rgba(255,255,255,0.6)' : settings.primaryColor}`,
      background: settings.layout === 'modern' ? 'rgba(255,255,255,0.2)' : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28, fontWeight: 700,
      color: settings.layout === 'modern' ? 'white' : settings.primaryColor,
    }}>E</div>
  );

  if (settings.layout === 'modern') {
    return (
      <div style={{ background: settings.primaryColor, color: 'white', padding: '20px 30px', display: 'flex', alignItems: 'center', gap: 20 }}>
        {settings.logoPosition === 'left' && <Logo />}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>COLEGIO SAN MARTÍN</div>
          <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Boletín de Calificaciones</div>
        </div>
        {settings.logoPosition === 'center' && <Logo />}
      </div>
    );
  }

  if (settings.layout === 'institutional') {
    return (
      <div style={{ textAlign: 'center', padding: '24px 30px 16px', borderBottom: `3px solid ${settings.primaryColor}` }}>
        <Logo />
        <div style={{ fontSize: 24, fontWeight: 700, color: settings.primaryColor, marginTop: 12 }}>COLEGIO SAN MARTÍN</div>
        <div style={{ fontSize: 14, color: settings.secondaryColor, marginTop: 4 }}>Boletín de Calificaciones</div>
      </div>
    );
  }

  // classic
  return (
    <div style={{ borderBottom: `3px solid ${settings.primaryColor}`, paddingBottom: 16, margin: '0 30px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20, paddingTop: 20,
        justifyContent: settings.logoPosition === 'center' ? 'center' : 'flex-start',
        flexDirection:  settings.logoPosition === 'center' ? 'column' : 'row',
      }}>
        {settings.logoPosition !== 'none' && <Logo />}
        <div style={{ textAlign: settings.logoPosition === 'center' ? 'center' : 'left' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: settings.primaryColor }}>COLEGIO SAN MARTÍN</div>
          <div style={{ fontSize: 14, color: settings.secondaryColor, marginTop: 2 }}>Boletín de Calificaciones</div>
        </div>
      </div>
    </div>
  );
}

// ── Contenido del preview ─────────────────────
function PreviewContent({ settings }: { settings: ReportSettings }) {
  const sampleRows = [
    ['Matemáticas', '8.5', '9.0', '—', '8.8'],
    ['Lengua',      '7.0', '8.0', '—', '7.5'],
    ['Ciencias',    '9.0', '—',   '—', '9.0'],
  ];

  return (
    <div style={{ background: 'white' }}>
      <PreviewHeader settings={settings} />

      <div style={{ padding: '12px 30px', display: 'flex', gap: 20, fontSize: 12, color: settings.textColor }}>
        <span><strong style={{ color: settings.primaryColor }}>Estudiante: </strong>García, María</span>
        <span><strong style={{ color: settings.primaryColor }}>Curso: </strong>3ro A</span>
        <span><strong style={{ color: settings.primaryColor }}>Ciclo lectivo: </strong>2026</span>
      </div>

      <div style={{ padding: '0 30px 30px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: settings.secondaryColor, borderBottom: `1px solid ${settings.secondaryColor}`, paddingBottom: 3, marginBottom: 10 }}>
          Calificaciones
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {['Materia', '1er Trimestre', '2do Trimestre', '3er Trimestre', 'Promedio'].map((h) => (
                <th key={h} style={{ background: settings.primaryColor, color: 'white', padding: '8px 10px', textAlign: h === 'Materia' ? 'left' : 'center' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sampleRows.map(([mat, t1, t2, t3, avg], i) => (
              <tr key={mat} style={{ background: i % 2 === 1 ? '#f5f5f5' : 'white' }}>
                <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontWeight: 500, color: settings.textColor }}>{mat}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'center', color: settings.textColor }}>{t1}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'center', color: settings.textColor }}>{t2}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'center', color: settings.textColor }}>{t3}</td>
                <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{avg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────
export function ReportPreview({ settings }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Vista previa</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setExpanded(true)}>
              Ver en pantalla completa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-hidden rounded-b-lg cursor-zoom-in" onClick={() => setExpanded(true)}>
          <div style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '166%', pointerEvents: 'none' }}>
            <PreviewContent settings={settings} />
          </div>
        </CardContent>
      </Card>

      {/* Modal expandido */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-medium text-sm text-gray-700">Vista previa del boletín</span>
              <button
                onClick={() => setExpanded(false)}
                className="text-gray-500 hover:text-gray-700 text-xl font-bold leading-none"
              >
                ✕
              </button>
            </div>
            <PreviewContent settings={settings} />
          </div>
        </div>
      )}
    </>
  );
}