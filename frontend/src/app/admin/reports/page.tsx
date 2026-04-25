'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Settings } from 'lucide-react';
import { GenerateReportTab }  from './_components/generate-report-tab';
import { ReportSettingsTab }  from './_components/report-settings-tab';

export default function ReportsPage() {
  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Generá boletines en PDF y configurá el diseño institucional
        </p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Generar reportes
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Configuración
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-4">
          <GenerateReportTab />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <ReportSettingsTab />
        </TabsContent>
      </Tabs>

    </div>
  );
}