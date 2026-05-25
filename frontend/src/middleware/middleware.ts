import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const ADMIN_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY', 'PRECEPTOR', 'SUPER_ADMIN'];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn  = !!req.auth;
  const pathname    = nextUrl.pathname;

  if (!isLoggedIn) {
    if (pathname === '/login') return NextResponse.next();
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  const role = req.auth?.user?.role as string;

  // Redirigir / y /dashboard según el rol
  if (pathname === '/' || pathname === '/dashboard') {
    if (ADMIN_ROLES.includes(role)) {
      return NextResponse.redirect(new URL('/admin/dashboard', nextUrl));
    }
    if (role === 'TEACHER') {
      return NextResponse.redirect(new URL('/teacher/dashboard', nextUrl));
    }
    if (role === 'GUARDIAN') {
      return NextResponse.redirect(new URL('/guardian/dashboard', nextUrl));
    }
    // fallback
    return NextResponse.redirect(new URL('/admin/dashboard', nextUrl));
  }

  // Proteger rutas /admin solo para roles con acceso al panel
  if (pathname.startsWith('/admin') && !ADMIN_ROLES.includes(role) && role !== 'TEACHER') {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  if (pathname.startsWith('/guardian') && role !== 'GUARDIAN') {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  if (pathname === '/profile') {
    return NextResponse.next();
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/', '/dashboard', '/admin/:path*', '/teacher/:path*', '/guardian', '/guardian/:path*', '/profile'],
};