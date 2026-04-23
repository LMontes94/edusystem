// src/lib/api/courses.ts
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { SchoolYear, CreateCourseForm, CreateSchoolYearForm, CreatePeriodForm } from '@/app/admin/courses/_components/courses.types';

export interface Course {
  id:           string;
  name:         string;
  grade:        number;
  division:     string;
  level:        string;
  schoolYearId: string;
  schoolYear:   { year: number; isActive: boolean };
  _count?:      { courseStudents: number; courseSubjects: number };
}

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn:  async () => {
      const res = await api.get<Course[]>('/courses');
      return res.data;
    },
  });
}

export function useEnrollStudent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ studentId, courseId }: { studentId: string; courseId: string }) => {
      const res = await api.post(`/students/${studentId}/enroll`, { courseId });
      return res.data;
    },
    onSuccess: (_data, { studentId }) => {
      queryClient.invalidateQueries({ queryKey: ['students', studentId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('Alumno matriculado exitosamente');
    },
    onError: () => toast.error('Error al matricular el alumno'),
  });
}

// ── Años lectivos ─────────────────────────────
export function useSchoolYears() {
  return useQuery<SchoolYear[]>({
    queryKey: ['school-years'],
    queryFn:  async () => {
      const res = await api.get('/courses/school-years');
      return res.data;
    },
  });
}
 
export function useCreateSchoolYear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateSchoolYearForm) => {
      const res = await api.post('/courses/school-years', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-years'] });
      toast.success('Año lectivo creado');
    },
    onError: () => toast.error('Error al crear el año lectivo'),
  });
}
 
// ── Períodos ──────────────────────────────────
export function usePeriods(schoolYearId?: string) {
  return useQuery({
    queryKey: ['periods', schoolYearId],
    queryFn:  async () => {
      const res = await api.get(`/courses/school-years/${schoolYearId}/periods`);
      return res.data;
    },
    enabled: !!schoolYearId,
  });
}
 
export function useCreatePeriod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePeriodForm) => {
      const res = await api.post('/courses/periods', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      toast.success('Período creado');
    },
    onError: () => toast.error('Error al crear el período'),
  });
}
 
export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateCourseForm) => {
      const res = await api.post('/courses', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Curso creado exitosamente');
    },
    onError: () => toast.error('Error al crear el curso'),
  });
}
 
// ── Asignar materia al curso ──────────────────
export function useAssignSubject(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      subjectId:    string;
      teacherId:    string;
      hoursPerWeek?: number;
    }) => {
      await api.post(`/courses/${courseId}/subjects`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
      toast.success('Materia asignada exitosamente');
    },
    onError: () => toast.error('Error al asignar la materia'),
  });
}
 
// ── Quitar materia del curso ──────────────────
export function useRemoveSubject(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (courseSubjectId: string) => {
      await api.delete(`/courses/${courseId}/subjects/${courseSubjectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses', courseId] });
      toast.success('Materia quitada del curso');
    },
    onError: () => toast.error('Error al quitar la materia'),
  });
}
 
// ── Export Excel alumnos del curso ────────────
export function useExportCourseStudents() {
  return useMutation({
    mutationFn: async ({
      courseId,
      courseName,
      students,
    }: {
      courseId:   string;
      courseName: string;
      students:   { firstName: string; lastName: string; documentNumber: string; status: string }[];
    }) => {
      // Construir CSV y convertir a Excel-compatible usando blob
      const headers = ['Apellido', 'Nombre', 'DNI', 'Estado'];
      const rows    = students.map((s) => [
        s.lastName,
        s.firstName,
        s.documentNumber,
        s.status === 'ACTIVE' ? 'Activo' : s.status,
      ]);
 
      // BOM para que Excel lo abra con tildes correctamente
      const bom  = '\uFEFF';
      const csv  = bom + [headers, ...rows]
        .map((r) => r.map((cell) => `"${cell}"`).join(','))
        .join('\n');
 
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `alumnos_${courseName.replace(/\s+/g, '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('Archivo descargado'),
    onError:   () => toast.error('Error al exportar'),
  });
}