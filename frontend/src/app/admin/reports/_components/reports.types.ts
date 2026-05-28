export interface ReportSettings {
  primaryColor?:   string;
  secondaryColor?: string;
  textColor?:      string;
  logoPosition?:   'center' | 'left' | 'none';
  layout?:         'classic' | 'institutional' | 'modern';
}

export const DEFAULT_SETTINGS: ReportSettings = {
  primaryColor:   '#1e3a5f',
  secondaryColor: '#2d6a9f',
  textColor:      '#1a1a1a',
  logoPosition:   'center',
  layout:         'classic',
};

export const layoutLabels: Record<string, string> = {
  classic:       'Clásico',
  institutional: 'Institucional',
  modern:        'Moderno',
};

export const layoutDescriptions: Record<string, string> = {
  classic:       'Clásico: diseño tradicional con línea divisoria, ideal para secundaria.',
  institutional: 'Institucional: escudo grande centrado en el header, formal y elegante.',
  modern:        'Moderno: header con fondo de color sólido, diseño contemporáneo.',
};

export const logoPositionLabels: Record<string, string> = {
  center: 'Centro',
  left:   'Izquierda',
  none:   'Sin escudo',
};

// Re-export desde el helper global
export { downloadBlob } from '@/lib/utils/download/download-blob';