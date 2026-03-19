-- ──────────────────────────────────────────────
-- init.sql — índices que Prisma no puede generar
-- Ejecutar DESPUÉS de: npx prisma migrate dev
-- ──────────────────────────────────────────────

-- Índice parcial: garantiza unicidad de email
-- solo para SUPER_ADMIN (institution_id IS NULL).
-- Los usuarios normales tienen @@unique([email, institutionId])
-- definido en el schema Prisma.
-- Sin este índice, dos SUPER_ADMIN podrían tener el mismo email.

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_super_admin
  ON users (email)
  WHERE institution_id IS NULL;
