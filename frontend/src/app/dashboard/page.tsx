import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const role = session.user?.role as string;

  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    redirect('/admin/dashboard');
  }

  if (role === 'TEACHER') {
    redirect('/teacher/dashboard');
  }

  redirect('/login');
}