import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const role = session.user?.role as string;

  if (role === 'GUARDIAN') {
    redirect('/guardian/dashboard');
  }

  if (role === 'TEACHER') {
    redirect('/teacher/dashboard');
  }

  // ADMIN, SUPER_ADMIN, DIRECTOR, SECRETARY, PRECEPTOR
  redirect('/admin/dashboard');
}