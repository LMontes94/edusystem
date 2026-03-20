# EduSystem — Sistema de Gestión Educativa

Plataforma completa para gestión de instituciones educativas con:
- 🖥 **Panel Web** administrativo (Next.js 14 + TailwindCSS)
- 📱 **App Mobile** para familias (React Native + Expo)
- ⚙️ **API REST** robusta (NestJS + PostgreSQL)

## Estructura del proyecto

```
edusystem/
├── backend/           # NestJS API
│   ├── prisma/        # Schema y migraciones
│   └── src/
│       ├── auth/      # JWT + Passport
│       ├── users/     # Gestión de usuarios
│       ├── students/  # Alumnos
│       ├── courses/   # Cursos
│       ├── subjects/  # Materias
│       ├── grades/    # Calificaciones
│       ├── attendance/# Asistencia
│       ├── announcements/ # Novedades
│       ├── chat/      # WebSocket chat
│       ├── notifications/ # Push notifications
│       └── reports/   # Generación PDF
│
├── frontend/          # Next.js Panel Admin
│   └── src/
│       ├── app/       # App Router pages
│       ├── components/# UI Components
│       ├── hooks/     # Custom hooks
│       ├── lib/       # API client
│       └── types/     # TypeScript types
│
├── mobile/            # React Native + Expo
│   └── src/
│       ├── app/       # Expo Router screens
│       ├── services/  # API services
│       └── store/     # Zustand state
│
└── docker-compose.yml # Full stack Docker
```

## Inicio rápido

### Con Docker (recomendado)
```bash
docker-compose up -d
```

### Desarrollo local

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev
# API: http://localhost:4000/api/v1
```

**Frontend:**
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
# Web: http://localhost:3000
```

**Mobile:**
```bash
cd mobile
npm install
npx expo start
# Escanear QR con Expo Go
```

## Credenciales de prueba
| Rol | Email | Contraseña |
|-----|-------|-----------|
| Admin | admin@edusystem.com | Admin123! |
| Docente | docente@edusystem.com | Docente123! |
| Padre | padre@edusystem.com | Padre123! |

## Stack técnico
| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 14, TailwindCSS, shadcn/ui, React Query |
| Backend | NestJS, Prisma ORM, JWT, Socket.io |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Mobile | React Native, Expo SDK 51, NativeWind |
| Auth | JWT Access + Refresh Tokens, RBAC |
| Realtime | Socket.io con Redis Adapter |
| Push | Firebase Cloud Messaging (FCM) |
| PDF | Puppeteer + Handlebars templates |
| Storage | S3 / MinIO (self-hosted) |
