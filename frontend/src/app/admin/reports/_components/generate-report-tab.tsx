'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCourses } from '@/lib/api/courses';
import { useSchoolYears } from '@/lib/api/courses';
import { ReportTypeSelector } from './report-type-selector';
import { ReportFilters } from './report-filters';
import { ReportIndividualSection } from './report-individual-section';
import { ReportBulkSection } from './report-bulk-section';
import type { ReportType } from '@/features/reports/types';
import { REPORT_TYPES, EDUCATION_LEVEL_TO_COURSE_LEVEL } from '@/features/reports/types';

export function GenerateReportTab() {
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reportType, setReportType] = useState<ReportType>('RITE');

  const { data: courses } = useCourses();
  const { data: schoolYears } = useSchoolYears();

  const { data: courseDetail } = useQuery({
    queryKey: ['courses', selectedCourse],
    queryFn: async () => {
      const res = await api.get(`/courses/${selectedCourse}`);
      return res.data;
    },
    enabled: !!selectedCourse,
  });

  const filteredCourses = (courses ?? []).filter(
    (c: any) =>
      (c.levelGrade?.educationLevel?.slug ?? c.level?.toLowerCase())
      === REPORT_TYPES[reportType].educationLevel.toLowerCase(),
  );

  const activeStudents = courseDetail?.courseStudents
    ?.filter((cs: any) => cs.status === 'ACTIVE')
    .sort((a: any, b: any) => a.student.lastName.localeCompare(b.student.lastName))
    ?? [];

  return (
    <div className="space-y-4">

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
