'use client';

import { useState }  from 'react';
import { Button }    from '@/components/ui/button';
import { Input }     from '@/components/ui/input';
import { Label }     from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette }   from 'lucide-react';
import {
  useReportSettings, useSaveReportSettings,
} from '@/lib/api/reports';
import { ReportPreview }                from './report-preview';
import {
  ReportSettings, layoutLabels, layoutDescriptions, logoPositionLabels,
} from './reports.types';

export function ReportSettingsTab() {
  const { data: savedSettings } = useReportSettings();
  const saveSettings            = useSaveReportSettings();

  const [settings, setSettings] = useState<ReportSettings>(savedSettings ?? {});

  // Sincronizar cuando llegan los settings guardados
  // (solo la primera vez que se cargan)
  const merged = { ...savedSettings, ...settings };

  function update(key: keyof ReportSettings, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="space-y-4">

      {/* Colores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Colores del boletín
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {([
              { key: 'primaryColor',   label: 'Color primario'   },
              { key: 'secondaryColor', label: 'Color secundario' },
              { key: 'textColor',      label: 'Color de texto'   },
            ] as { key: keyof ReportSettings; label: string }[]).map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={merged[key] as string ?? '#000000'}
                    onChange={(e) => update(key, e.target.value)}
                    className="h-9 w-9 rounded border cursor-pointer"
                  />
                  <Input
                    value={merged[key] as string ?? ''}
                    onChange={(e) => update(key, e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Diseño y logo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Diseño y logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Diseño de plantilla</Label>
              <Select value={merged.layout} onValueChange={(v) => update('layout', v)}>
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
              <Select value={merged.logoPosition} onValueChange={(v) => update('logoPosition', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(logoPositionLabels).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            {layoutDescriptions[merged.layout ?? 'classic']}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <ReportPreview settings={merged} />

      <Button
        onClick={() => saveSettings.mutate(merged)}
        disabled={saveSettings.isPending}
        className="w-full"
      >
        {saveSettings.isPending ? 'Guardando...' : 'Guardar configuración'}
      </Button>
    </div>
  );
}