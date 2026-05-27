export function renderStudentInfo(
  student: { firstName: string; lastName: string; documentNumber: string },
  course: { name: string; grade: number; division: string; level: string },
  schoolYear: number,
): string {
  return `
    <div class="info-row">
      <span><span class="info-label">Estudiante: </span>${student.lastName}, ${student.firstName}</span>
      <span><span class="info-label">Curso: </span>${course.name}</span>
      <span><span class="info-label">Ciclo lectivo: </span>${schoolYear}</span>
      <span><span class="info-label">DNI: </span>${student.documentNumber}</span>
    </div>`;
}
