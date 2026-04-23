'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from 'lucide-react';

interface Student {
  firstName:      string;
  lastName:       string;
  documentNumber: string;
  birthDate:      string;
  bloodType?:     string | null;
  medicalNotes?:  string | null;
}

interface Props {
  student: Student;
}

function calcAge(birthDate: string): number {
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

export function PersonalInfoCard({ student }: Props) {
  const age = calcAge(student.birthDate);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <User className="h-4 w-4" />
          Datos personales
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Nombre completo</dt>
            <dd className="font-medium mt-0.5">{student.firstName} {student.lastName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">DNI</dt>
            <dd className="font-medium mt-0.5">{student.documentNumber}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Fecha de nacimiento</dt>
            <dd className="font-medium mt-0.5">
              {new Date(student.birthDate).toLocaleDateString('es-AR')} ({age} años)
            </dd>
          </div>
          {student.bloodType && (
            <div>
              <dt className="text-muted-foreground">Grupo sanguíneo</dt>
              <dd className="font-medium mt-0.5">{student.bloodType}</dd>
            </div>
          )}
          {student.medicalNotes && (
            <div className="col-span-2">
              <dt className="text-muted-foreground">Notas médicas</dt>
              <dd className="font-medium mt-0.5">{student.medicalNotes}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}