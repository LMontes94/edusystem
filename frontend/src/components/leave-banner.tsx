'use client';

import { useSession } from 'next-auth/react';
import { BriefcaseMedical } from 'lucide-react';

export function LeaveBanner() {
  const { data: session } = useSession();

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