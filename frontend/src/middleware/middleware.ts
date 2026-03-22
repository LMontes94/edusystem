// src/middleware.ts
// ──────────────────────────────────────────────
// Middleware de Next.js — protege rutas por rol.
//
// Rutas públicas: /login
// Rutas de ADMIN:   /admin/*
// Rutas de TEACHER: /teacher/*
// Rutas compartidas: /dashboard (redirige según rol)
// ──────────────────────────────────────────────
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn  = !!req.auth;
  const pathname    = nextUrl.pathname;

  // Si no está logueado → redirigir a login
  if (!isLoggedIn) {
    if (pathname === '/login') return NextResponse.next();
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  const role = req.auth?.user?.role as string;

  // Redirigir / y /dashboard según el rol
  if (pathname === '/' || pathname === '/dashboard') {
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/admin/dashboard', nextUrl));
    }
    if (role === 'TEACHER') {
      return NextResponse.redirect(new URL('/teacher/dashboard', nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/', '/dashboard', '/admin/:path*', '/teacher/:path*'],
};