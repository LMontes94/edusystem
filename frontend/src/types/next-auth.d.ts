// src/types/next-auth.d.ts
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    id:            string;
    role:          string;
    institutionId: string | null;
    accessToken:   string;
    refreshToken:  string;
  }

  interface Session {
    user: {
      id:            string;
      email:         string;
      name:          string;
      role:          string;
      institutionId: string | null;
      status:        string;
    };
    accessToken:  string;
    refreshToken: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:            string;
    role:          string;
    institutionId: string | null;
    accessToken:   string;
    refreshToken:  string;
  }
}
