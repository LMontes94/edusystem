'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppSession } from '@/lib/hooks/use-app-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportTypeSelector } from '@/app/admin/reports/_components/report-type-selector';
import { ReportFilters } from '@/app/admin/reports/_components/report-filters';
import { ReportIndividualSection } from '@/app/admin/reports/_components/report-individual-section';
import { ReportBulkSection } from '@/app/admin/reports/_components/report-bulk-section';
import type { ReportType } from '@/features/reports/types';
import { REPORT_TYPES, EDUCATION_LEVEL_TO_COURSE_LEVEL } from '@/features/reports/types';

export default function TeacherReportsPage() {
  const { data: session } = useAppSession();
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reportType, setReportType] = useState<ReportType>('RITE');

  const { data: courses } = useQuery({
    queryKey: ['courses', 'teacher'],
    queryFn: async () => {
      const res = await api.get('/courses');
      return res.data;
    },
  });

  const { data: schoolYears } = useQuery({
    queryKey: ['school-years'],
    queryFn: async () => {
      const res = await api.get('/courses/school-years');
      return res.data;
    },
  });

  const filteredCourses = (courses ?? []).filter(
    (c: any) => c.level === EDUCATION_LEVEL_TO_COURSE_LEVEL[REPORT_TYPES[reportType].educationLevel]
  );

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn: async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const activeStudents = courseDetail?.courseStudents
    ?.filter((cs: any) => cs.status === 'ACTIVE')
    .sort((a: any, b: any) => a.student.lastName.localeCompare(b.student.lastName))
    ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reportes</h1>
        <p className="text-sm text-muted-foreground">
          Descargá RITE y Valoraciones de tus cursos
        </p>
      </div>

      <ReportTypeSelector value={reportType} onChange={(v) => { setReportType(v); setSelectedCourse(''); setSelectedStudent(''); }} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Selección</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ReportFilters
            schoolYears={schoolYears ?? []}
            selectedSchoolYear={selectedSchoolYear}
            onSchoolYearChange={(v) => { setSelectedSchoolYear(v); }}
            courses={filteredCourses}
            selectedCourse={selectedCourse}
            onCourseChange={(v) => { setSelectedCourse(v); setSelectedStudent(''); }}
          />
        </CardContent>
      </Card>

      <ReportIndividualSection
        reportType={reportType}
        students={activeStudents}
        selectedStudent={selectedStudent}
        onStudentChange={setSelectedStudent}
        schoolYearId={selectedSchoolYear}
        generating={false}
        studentSelectDisabled={!selectedCourse}
      />

      <ReportBulkSection
        reportType={reportType}
        courseId={selectedCourse}
        schoolYearId={selectedSchoolYear}
        studentCount={activeStudents.length}
        generating={false}
        disabled={!selectedCourse || !selectedSchoolYear}
      />
    </div>
  );
}
