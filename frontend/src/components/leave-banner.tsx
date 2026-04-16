'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Archivo: src/components/leave-banner.tsx
// Banner que se muestra en el layout /teacher cuando el usuario está ON_LEAVE.
//
// Uso en src/app/teacher/layout.tsx:
//
//   import { LeaveBanner } from '@/components/leave-banner';
//
//   export default function TeacherLayout({ children }) {
//     return (
//       <div>
//         <LeaveBanner />       ← agregar antes del children
//         {children}
//       </div>
//     );
//   }
// ─────────────────────────────────────────────────────────────────────────────

import { useSession } from 'next-auth/react';
import { BriefcaseMedical } from 'lucide-react';

export function LeaveBanner() {
  const { data: session } = useSession();

  // El status del usuario debe estar disponible en el JWT / session
  // Asegurate de incluirlo en el callback jwt de NextAuth:
  //   token.status = user.status
  //   token.leaveStartDate = user.leaveStartDate
  const status         = (session?.user as any)?.status;
  const leaveStartDate = (session?.user as any)?.leaveStartDate;

  if (status !== 'ON_LEAVE') return null;

  const formattedDate = leaveStartDate
    ? leaveStartDate.split('T')[0].split('-').reverse().join('/')
    : null;

  return (
    <div className="w-full bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <BriefcaseMedical className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          <span className="font-semibold">Tu cuenta está en licencia</span>
          {formattedDate && (
            <span className="font-normal"> desde el {formattedDate}</span>
          )}
          . Podés ver la información pero no podés realizar cambios. Contactá a un directivo para reactivar tu cuenta.
        </p>
      </div>
    </div>
  );
}