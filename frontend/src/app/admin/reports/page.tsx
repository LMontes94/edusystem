'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useCourses } from '@/lib/api/courses';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  FileText, Download, Settings, Palette, GraduationCap, Users,
} from 'lucide-react';

interface ReportSettings {
  primaryColor?:   string;
  secondaryColor?: string;
  textColor?:      string;
  logoPosition?:   'center' | 'left' | 'none';
  layout?:         'classic' | 'institutional' | 'modern';
}

const layoutLabels = {
  classic:       'Clásico',
  institutional: 'Institucional',
  modern:        'Moderno',
};

const logoPositionLabels = {
  center: 'Centro',
  left:   'Izquierda',
  none:   'Sin escudo',
};

export default function ReportsPage() {
  const { data: session }   = useSession();
  const institutionId       = session?.user?.institutionId;

  const [selectedCourse,     setSelectedCourse]     = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedStudent,    setSelectedStudent]     = useState('');
  const [reportType,         setReportType]          = useState<'secondary' | 'primary'>('secondary');
  const [generating,         setGenerating]          = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  // Settings locales para preview
  const [settings, setSettings] = useState<ReportSettings>({
    primaryColor:   '#1e3a5f',
    secondaryColor: '#2d6a9f',
    textColor:      '#1a1a1a',
    logoPosition:   'center',
    layout:         'classic',
  });

  const { data: courses }    = useCourses();
  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn:  async () => {
      const res = await api.get('/courses/school-years');
      return res.data;
    },
  });

  // Cargar settings guardados
  useQuery({
    queryKey: ['report-settings', institutionId],
    queryFn:  async () => {
      const res = await api.get('/reports/settings');
      if (Object.keys(res.data).length > 0) {
        setSettings((prev) => ({ ...prev, ...res.data }));
      }
      return res.data;
    },
    enabled: !!institutionId,
  });

  // Alumnos del curso seleccionado
  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn:  async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const activeStudents = courseDetail?.courseStudents
    ?.filter((cs: any) => cs.status === 'ACTIVE')
    .sort((a: any, b: any) => a.student.lastName.localeCompare(b.student.lastName))
    ?? [];

  // Guardar settings
  const saveSettings = useMutation({
    mutationFn: async () => {
      await api.post('/reports/settings', settings);
    },
    onSuccess: () => toast.success('Configuración guardada'),
    onError:   () => toast.error('Error al guardar la configuración'),
  });

  // Generar PDF — un alumno
  async function handleGenerateSingle() {
    if (!selectedStudent || !selectedSchoolYear) {
      toast.error('Seleccioná un alumno y un año lectivo');
      return;
    }

    setGenerating(true);
    try {
      const endpoint = reportType === 'secondary'
        ? `/reports/secondary/${selectedStudent}`
        : `/reports/primary/${selectedStudent}`;

      const res = await api.get(endpoint, {
        params:       { schoolYearId: selectedSchoolYear },
        responseType: 'blob',
      });

      const url      = window.URL.createObjectURL(new Blob([res.data]));
      const link     = document.createElement('a');
      link.href      = url;
      const contentDisposition = res.headers['content-disposition'];
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      link.download = filenameMatch?.[1] ?? `reporte_${selectedStudent}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF generado exitosamente');
    } catch {
      toast.error('Error al generar el PDF');
    } finally {
      setGenerating(false);
    }
  }

  // Generar ZIP — curso completo
  async function handleGenerateBulk() {
    if (!selectedCourse || !selectedSchoolYear) {
      toast.error('Seleccioná un curso y un año lectivo');
      return;
    }

    setGenerating(true);
    try {
      const endpoint = reportType === 'secondary'
        ? `/reports/secondary/bulk/${selectedCourse}`
        : `/reports/primary/bulk/${selectedCourse}`;

      const res = await api.get(endpoint, {
        params:       { schoolYearId: selectedSchoolYear },
        responseType: 'blob',
      });

      const url      = window.URL.createObjectURL(new Blob([res.data]));
      const link     = document.createElement('a');
      link.href      = url;
      const contentDisposition = res.headers['content-disposition'];
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      link.download = filenameMatch?.[1] ?? `boletines_${selectedCourse}.zip`;  
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success('ZIP generado exitosamente');
    } catch {
      toast.error('Error al generar el ZIP');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Generá boletines e informes en PDF
        </p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">
            <FileText className="h-4 w-4 mr-2" />
            Generar reportes
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Configuración de diseño
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Generar reportes ── */}
        <TabsContent value="generate" className="space-y-4 mt-4">

          {/* Tipo de reporte */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Tipo de reporte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <button
                  onClick={() => setReportType('secondary')}
                  className={`flex-1 rounded-lg border p-4 text-left transition-colors ${
                    reportType === 'secondary'
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium text-sm">Boletín de Secundaria</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Notas numéricas por período, promedio final y asistencia
                  </div>
                </button>
                <button
                  onClick={() => setReportType('primary')}
                  className={`flex-1 rounded-lg border p-4 text-left transition-colors ${
                    reportType === 'primary'
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="font-medium text-sm">Informe Cualitativo de Primaria</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Indicadores con valoración Logrado / Med. Logrado / No logrado
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Filtros */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Selección</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Año lectivo</Label>
                  <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                    <SelectTrigger><SelectValue placeholder="Seleccioná..." /></SelectTrigger>
                    <SelectContent>
                      {schoolYears?.map((sy: any) => (
                        <SelectItem key={sy.id} value={sy.id}>
                          {sy.year} {sy.isActive && '(activo)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Curso</Label>
                  <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setSelectedStudent(''); }}>
                    <SelectTrigger><SelectValue placeholder="Seleccioná..." /></SelectTrigger>
                    <SelectContent>
                      {courses?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCourse && (
                <div className="space-y-1.5">
                  <Label>Alumno (opcional — si no seleccionás se genera para todo el curso)</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger><SelectValue placeholder="Todo el curso..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo el curso</SelectItem>
                      {activeStudents.map((cs: any) => (
                        <SelectItem key={cs.student.id} value={cs.student.id}>
                          {cs.student.lastName}, {cs.student.firstName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="flex gap-3">
            <Button
              onClick={selectedStudent ? handleGenerateSingle : handleGenerateBulk}
              disabled={generating || !selectedSchoolYear || !selectedCourse}
              className="flex-1"
            >
              <Download className="h-4 w-4 mr-2" />
              {generating
                ? 'Generando...'
                : selectedStudent
                ? 'Descargar PDF'
                : `Descargar ZIP (${activeStudents.length} boletines)`}
            </Button>
          </div>

          {!selectedSchoolYear && (
            <p className="text-xs text-muted-foreground text-center">
              Seleccioná un año lectivo y un curso para generar los reportes
            </p>
          )}
        </TabsContent>

        {/* ── Tab: Configuración de diseño ── */}
        <TabsContent value="settings" className="space-y-4 mt-4">

          {/* Colores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Paleta de colores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Color primario</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings((p) => ({ ...p, primaryColor: e.target.value }))}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) => setSettings((p) => ({ ...p, primaryColor: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Header y tablas</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Color secundario</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings((p) => ({ ...p, secondaryColor: e.target.value }))}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings((p) => ({ ...p, secondaryColor: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Subtítulos y bordes</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Color de texto</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.textColor}
                      onChange={(e) => setSettings((p) => ({ ...p, textColor: e.target.value }))}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.textColor}
                      onChange={(e) => setSettings((p) => ({ ...p, textColor: e.target.value }))}
                      className="font-mono text-sm"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Texto principal</p>
                </div>
              </div>

              {/* Preview de colores */}
              <div
                className="rounded-lg p-4 text-white text-sm font-medium"
                style={{ background: settings.primaryColor }}
              >
                <div>COLEGIO SAN MARTÍN</div>
                <div
                  className="text-xs mt-1 opacity-90"
                  style={{ color: 'rgba(255,255,255,0.85)' }}
                >
                  Boletín de Calificaciones
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Diseño */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Diseño y logo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Diseño de plantilla</Label>
                  <Select
                    value={settings.layout}
                    onValueChange={(v) => setSettings((p) => ({ ...p, layout: v as any }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(layoutLabels).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Posición del escudo</Label>
                  <Select
                    value={settings.logoPosition}
                    onValueChange={(v) => setSettings((p) => ({ ...p, logoPosition: v as any }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(logoPositionLabels).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Descripción del diseño seleccionado */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                {settings.layout === 'classic' && 'Clásico: diseño tradicional con línea divisoria, ideal para secundaria.'}
                {settings.layout === 'institutional' && 'Institucional: escudo grande centrado en el header, formal y elegante.'}
                {settings.layout === 'modern' && 'Moderno: header con fondo de color sólido, diseño contemporáneo.'}
              </div>
            </CardContent>
          </Card>
          <CardContent className="p-0 overflow-hidden rounded-b-lg">
        
        {/* Preview del boletín */}
<Card>
  <CardHeader className="pb-3">
    <div className="flex items-center justify-between">
      <CardTitle className="text-sm font-medium">Vista previa</CardTitle>
      <Button size="sm" variant="outline" onClick={() => setPreviewExpanded(true)}>
        Ver en pantalla completa
      </Button>
    </div>
  </CardHeader>
  <CardContent className="p-0 overflow-hidden rounded-b-lg cursor-zoom-in" onClick={() => setPreviewExpanded(true)}>
    <div style={{ transform: 'scale(0.6)', transformOrigin: 'top left', width: '166%', pointerEvents: 'none' }}>
      {/* ... contenido del preview igual que antes ... */}
    </div>
  </CardContent>
</Card>

{/* Modal de preview expandido */}
{previewExpanded && (
  <div
    className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
    onClick={() => setPreviewExpanded(false)}
  >
    <div
      className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <span className="font-medium text-sm text-gray-700">Vista previa del boletín</span>
        <button
          onClick={() => setPreviewExpanded(false)}
          className="text-gray-500 hover:text-gray-700 text-xl font-bold leading-none"
        >
          ✕
        </button>
      </div>
      <div style={{ padding: '0', background: 'white' }}>
        {/* Mismo contenido del preview pero sin scale */}

        {settings.layout === 'modern' && (
          <div style={{ background: settings.primaryColor, color: 'white', padding: '20px 30px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            {settings.logoPosition === 'left' && (
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>E</div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>COLEGIO SAN MARTÍN</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>Boletín de Calificaciones</div>
            </div>
            {settings.logoPosition === 'center' && (
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 24 }}>E</div>
            )}
          </div>
        )}

        {settings.layout === 'institutional' && (
          <div style={{ textAlign: 'center', padding: '24px 30px 16px', borderBottom: `3px solid ${settings.primaryColor}` }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px solid ${settings.primaryColor}`, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, color: settings.primaryColor }}>E</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: settings.primaryColor, marginTop: 12 }}>COLEGIO SAN MARTÍN</div>
            <div style={{ fontSize: 14, color: settings.secondaryColor, marginTop: 4 }}>Boletín de Calificaciones</div>
          </div>
        )}

        {settings.layout === 'classic' && (
          <div style={{ borderBottom: `3px solid ${settings.primaryColor}`, paddingBottom: 16, margin: '0 30px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingTop: 20, justifyContent: settings.logoPosition === 'center' ? 'center' : 'flex-start', flexDirection: settings.logoPosition === 'center' ? 'column' : 'row' }}>
              {(settings.logoPosition === 'left' || settings.logoPosition === 'center') && (
                <div style={{ width: 70, height: 70, borderRadius: '50%', border: `2px solid ${settings.primaryColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: settings.primaryColor }}>E</div>
              )}
              <div style={{ textAlign: settings.logoPosition === 'center' ? 'center' : 'left' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: settings.primaryColor }}>COLEGIO SAN MARTÍN</div>
                <div style={{ fontSize: 14, color: settings.secondaryColor, marginTop: 2 }}>Boletín de Calificaciones</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: '12px 30px', display: 'flex', gap: 20, fontSize: 12, color: settings.textColor }}>
          <span><strong style={{ color: settings.primaryColor }}>Estudiante: </strong>García, María</span>
          <span><strong style={{ color: settings.primaryColor }}>Curso: </strong>3ro A</span>
          <span><strong style={{ color: settings.primaryColor }}>Ciclo lectivo: </strong>2026</span>
        </div>

        <div style={{ padding: '0 30px 30px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: settings.secondaryColor, borderBottom: `1px solid ${settings.secondaryColor}`, paddingBottom: 3, marginBottom: 10 }}>Calificaciones</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Materia', '1er Trimestre', '2do Trimestre', '3er Trimestre', 'Promedio'].map((h) => (
                  <th key={h} style={{ background: settings.primaryColor, color: 'white', padding: '8px 10px', textAlign: h === 'Materia' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Matemáticas', '8.5', '9.0', '—', '8.8'],
                ['Lengua',      '7.0', '8.0', '—', '7.5'],
                ['Ciencias',    '9.0', '—',   '—', '9.0'],
              ].map(([mat, t1, t2, t3, avg], i) => (
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
    </div>
  </div>
)}

</CardContent>
          <Button
            onClick={() => saveSettings.mutate()}
            disabled={saveSettings.isPending}
            className="w-full"
          >
            {saveSettings.isPending ? 'Guardando...' : 'Guardar configuración'}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}