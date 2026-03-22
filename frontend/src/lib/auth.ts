import NextAuth, { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const config: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/login`, {
            email:    credentials.email,
            password: credentials.password,
          });
          const { accessToken, refreshToken, user } = res.data;
          return {
            id:            user.id,
            email:         user.email,
            name:          `${user.firstName} ${user.lastName}`,
            role:          user.role,
            institutionId: user.institutionId,
            accessToken,
            refreshToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) Object.assign(token, user);
      return token;
    },
    async session({ session, token }) {
      session.user.id            = token.id as string;
      session.user.role          = token.role as string;
      session.user.institutionId = token.institutionId as string | null;
      session.accessToken        = token.accessToken as string;
      return session;
    },
  },
  pages:  { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, signIn, signOut, auth } = NextAuth(config);