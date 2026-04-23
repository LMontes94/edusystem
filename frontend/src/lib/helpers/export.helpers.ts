export type StudentExport = {
    Apellido: string;
    Nombre: string;
    DNI: string;
    Estado: string;
  };
  
  export function mapStudentsForExport(students: {
    firstName: string;
    lastName: string;
    documentNumber: string;
    status: string;
  }[]): StudentExport[] {
    return students.map((s) => ({
      Apellido: s.lastName,
      Nombre: s.firstName,
      DNI: s.documentNumber,
      Estado: s.status === 'ACTIVE' ? 'Activo' : s.status,
    }));
  }