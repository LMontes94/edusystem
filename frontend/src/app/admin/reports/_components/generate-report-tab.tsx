'use client';

import { useState }   from 'react';
import { useQuery }   from '@tanstack/react-query';
import { api }        from '@/lib/api';
import { Button }     from '@/components/ui/button';
import { Badge }      from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, GraduationCap, Users, FileText } from 'lucide-react';
import { useCourses }              from '@/lib/api/courses';
import { useSchoolYears }          from '@/lib/api/courses';
import { useGenerateSingleReport, useGenerateBulkReport } from '@/lib/api/reports';

type ReportType = 'secondary' | 'primary';

export function GenerateReportTab() {
  const [selectedCourse,     setSelectedCourse]     = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedStudent,    setSelectedStudent]    = useState('');
  const [reportType,         setReportType]         = useState<ReportType>('secondary');

  const { data: courses }     = useCourses();
  const { data: schoolYears } = useSchoolYears();

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

  const generateSingle = useGenerateSingleReport();
  const generateBulk   = useGenerateBulkReport();
  const generating     = generateSingle.isPending || generateBulk.isPending;

  return (
    <div className="space-y-4">

      {/* Tipo de reporte */}
      <div className="flex gap-2">
        {(['secondary', 'primary'] as ReportType[]).map((type) => (
          <Button
            key={type}
            size="sm"
            variant={reportType === type ? 'default' : 'outline'}
            onClick={() => setReportType(type)}
          >
            {type === 'secondary' ? 'Secundaria' : 'Primaria'}
          </Button>
        ))}
      </div>

      {/* Filtros comunes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Selección</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Año lectivo</label>
              <Select value={selectedSchoolYear} onValueChange={setSelectedSchoolYear}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un año..." /></SelectTrigger>
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
              <label className="text-sm font-medium">Curso</label>
              <Select value={selectedCourse} onValueChange={(v) => { setSelectedCourse(v); setSelectedStudent(''); }}>
                <SelectTrigger><SelectValue placeholder="Seleccioná un curso..." /></SelectTrigger>
                <SelectContent>
                  {courses?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Reporte individual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Alumno</label>
            <Select
              value={selectedStudent}
              onValueChange={setSelectedStudent}
              disabled={!selectedCourse}
            >
              <SelectTrigger><SelectValue placeholder="Seleccioná un alumno..." /></SelectTrigger>
              <SelectContent>
                {activeStudents.map((cs: any) => (
                  <SelectItem key={cs.student.id} value={cs.student.id}>
                    {cs.student.lastName}, {cs.student.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => generateSingle.mutate({ studentId: selectedStudent, schoolYearId: selectedSchoolYear, reportType })}
            disabled={!selectedStudent || !selectedSchoolYear || generating}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            {generateSingle.isPending ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </CardContent>
      </Card>

      {/* Bulk */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Curso completo
            {activeStudents.length > 0 && (
              <Badge variant="secondary">{activeStudents.length} alumnos</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => generateBulk.mutate({ courseId: selectedCourse, schoolYearId: selectedSchoolYear, reportType })}
            disabled={!selectedCourse || !selectedSchoolYear || generating}
            variant="outline"
            className="w-full"
          >
            <FileText className="h-4 w-4 mr-2" />
            {generateBulk.isPending ? 'Generando ZIP...' : 'Descargar ZIP del curso'}
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}