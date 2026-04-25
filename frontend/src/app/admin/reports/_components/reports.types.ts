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

// Helper para descargar un blob desde la API
export async function downloadBlob(
  blob: Blob,
  contentDisposition: string | undefined,
  fallbackName: string,
) {
  const match    = contentDisposition?.match(/filename="(.+)"/);
  const filename = match?.[1] ?? fallbackName;
  const url      = window.URL.createObjectURL(blob);
  const link     = document.createElement('a');
  link.href      = url;
  link.download  = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}