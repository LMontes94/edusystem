'use client';

import { useState } from 'react';
import { StudentHistorySheet } from './student-history-sheet';

interface Props {
  name: string;
  studentId?: string;
  className?: string;
}

export function StudentNameCell({ name, studentId, className }: Props) {
  const [open, setOpen] = useState(false);

  if (!studentId) {
    return <span className={className}>{name}</span>;
  }

  return (
    <>
      <button
        type="button"
        className={`hover:underline cursor-pointer text-left ${className ?? ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {name}
      </button>
      <StudentHistorySheet
        studentId={studentId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
