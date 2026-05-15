# EduSystem — Authentication & Authorization AI Agent Operational Guide

> **Version:** 1.0
> **Last Updated:** 2026-05-14
> **Classification:** Internal — AI Coding Agents & Security Engineering
> **Scope:** Authentication, Authorization, Session Security, Permission Enforcement & Identity Architecture
> **Parent:** `AGENTS.md` (full-stack source of truth)

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Scope](#2-scope)
3. [Non-Goals](#3-non-goals)
4. [Required Context](#4-required-context)
5. [Authentication Architectural Principles](#5-authentication-architectural-principles)
6. [Authorization Architectural Principles](#6-authorization-architectural-principles)
7. [JWT Rules](#7-jwt-rules)
8. [Refresh Token Rules](#8-refresh-token-rules)
9. [Session Security Rules](#9-session-security-rules)
10. [CASL Authorization Rules](#10-casl-authorization-rules)
11. [Role & Permission Rules](#11-role--permission-rules)
12. [Guard Rules](#12-guard-rules)
13. [Tenant-Aware Authorization Rules](#13-tenant-aware-authorization-rules)
14. [SUPER_ADMIN Rules](#14-super_admin-rules)
15. [Request Context Rules](#15-request-context-rules)
16. [Authentication Database Rules](#16-authentication-database-rules)
17. [Security Rules](#17-security-rules)
18. [Audit Logging Rules](#18-audit-logging-rules)
19. [Queue & Worker Auth Rules](#19-queue--worker-auth-rules)
20. [Error Handling Rules](#20-error-handling-rules)
21. [Performance & Scalability Rules](#21-performance--scalability-rules)
22. [Preferred Patterns](#22-preferred-patterns)
23. [Forbidden Patterns](#23-forbidden-patterns)
24. [Development Workflow Expectations](#24-development-workflow-expectations)
25. [Validation Checklist](#25-validation-checklist)
26. [Expected Quality Standards](#26-expected-quality-standards)

---

## 1. Purpose

This document is the authoritative behavioral and security guide for AI coding agents modifying **authentication, authorization, session security, permission enforcement, and identity-related architecture** within the EduSystem repository.

It defines the non-negotiable security guarantees, architectural invariants, and operational constraints that every auth-related code change must preserve.

Every modification to authentication or authorization functionality must preserve:

- **Authentication integrity** — JWT validation, refresh token rotation, credential safety
- **Authorization consistency** — CASL ABAC rules, role hierarchy, permission enforcement
- **Session security** — stateless token lifecycle, secure propagation, revocation semantics
- **JWT security guarantees** — signature verification, short TTL, payload constraints
- **Refresh token safety** — bcrypt-hashed storage, rotation on use, explicit revocation
- **Tenant-aware authorization** — institutionId scoping in every permission check
- **CASL permission enforcement** — ability-based checks at controller boundaries
- **Least privilege principles** — minimal token claims, scoped permissions, role-appropriate access
- **Secure identity boundaries** — no cross-tenant data leaks, no privilege escalation paths

Auth-related code changes carry elevated risk. A single mistake in this domain can expose every tenant's data. This agent exists to eliminate that risk category.

---

## 2. Scope

### 2.1 What This Agent Owns

| Area | Components | Criticality |
|------|-----------|-------------|
| Authentication | AuthController, AuthService, JwtStrategy, JwtAuthGuard | Critical |
| Token Management | Access token generation, refresh token lifecycle, revocation | Critical |
| Authorization | CaslGuard, CaslAbilityFactory, CheckAbility decorator | Critical |
| State Guards | OnLeaveGuard, SkipLeaveCheck decorator | Critical |
| Auth Middleware | TenantMiddleware (JWT decode + context injection) | Critical |
| Auth Data Models | RefreshToken, User (passwordHash, role, status), Permission | Critical |
| Public Routes | @Public() decorator semantics, exempt endpoint management | High |
| Auth Queue Jobs | audit.log, login/logout events | High |
| Auth Config | JWT_SECRET, JWT_REFRESH_SECRET, token TTLs, bcrypt cost | Critical |

### 2.2 What This Agent Does Not Own

- **General backend patterns** (controllers, services, DTOs, Prisma queries) — see `agents/backend-agent.md`
- **Frontend authentication** (NextAuth v5, session callbacks, client-side routing) — see `AGENTS.md`
- **Infrastructure secrets management** (Docker secrets, Vault integration) — see `docs/INFRASTRUCTURE.md`
- **Password reset flows** — not yet implemented; when implemented, must pass auth agent review
- **OAuth / SSO integration** — not yet implemented; when implemented, must pass auth agent review
- **MFA / 2FA** — not yet implemented; when implemented, must pass auth agent review
- **Rate limiting** — not yet implemented on auth endpoints; when implemented, must pass auth agent review

---

## 3. Non-Goals

The auth agent is not responsible for:

- **Physical infrastructure security** (TLS termination, network policies, WAF rules)
- **General input validation** beyond authentication DTOs (LoginSchema, RefreshSchema)
- **Frontend auth UI** (login page, session indicator, leave banner)
- **NextAuth session configuration** beyond ensuring backend tokens are correctly passed
- **Database backup/restore** of auth-related tables
- **General audit log content** beyond auth events (LOGIN, LOGOUT, refresh)
- **Password policy enforcement** beyond current Zod schema validation
- **Brute force protection** — not implemented; designated as future concern

---

## 4. Required Context

Before modifying any authentication or authorization behavior, AI agents **must** read the following documents in full:

| Document | Why It Is Required |
|----------|-------------------|
| `docs/AUTH.md` | Complete authentication architecture: JWT strategy, refresh token lifecycle, login/logout flow, guard execution order, security posture |
| `docs/MULTITENANCY.md` | Multi-tenancy model: tenant identification, JWT tenant propagation, TenantMiddleware, tenant-aware authorization, SUPER_ADMIN behavior |
| `docs/ARCHITECTURE.md` | System-level architecture: request lifecycle, module structure, dependency injection, dual-mode runtime, security considerations |
| `docs/DATABASE.md` | Auth data models (User, RefreshToken, Permission, UserLevelRole), indexing strategy, soft-delete interaction with auth, password hashing |
| `docs/WORKERS.md` | Background job processing: tenant-aware job payloads, idempotency, queue topology (notifications, audit-log) |
| `docs/INFRASTRUCTURE.md` | Infrastructure: Redis persistence for BullMQ, MinIO isolation, Docker Compose networking |
| `AGENTS.md` | Parent operational guide: forbidden/preferred patterns, development workflow, PR expectations, architectural rules |

**These documents are authoritative.** If there is ambiguity about auth behavior, these documents take precedence over any third-party library documentation or general best-practice guides.

---

## 5. Authentication Architectural Principles

### 5.1 Stateless JWT Authentication

EduSystem uses **stateless JWT authentication** with refresh token rotation. The API layer does not maintain server-side sessions. All authentication state is carried in cryptographically signed tokens.

```
Access Token (15m TTL):   JWT signed with JWT_SECRET     → Carries identity + tenant context
Refresh Token (7d TTL):   JWT signed with JWT_REFRESH_SECRET → Stored bcrypt-hashed in DB
```

### 5.2 Dual-Token Pattern

| Token | TTL | Signing Key | Storage | Purpose |
|-------|-----|-------------|---------|---------|
| Access Token | 15 minutes | JWT_SECRET | Client only (never server) | Authenticates API requests |
| Refresh Token | 7 days | JWT_REFRESH_SECRET | Server (bcrypt hash) + Client | Issues new access tokens |

The dual-token pattern balances security with UX:
- Short-lived access tokens limit blast radius of token theft
- Refresh token rotation provides auditable token lifecycle
- Separate signing keys isolate access from refresh compromise

### 5.3 Tenant-in-JWT

Tenant context (`institutionId`) is embedded in the JWT payload at login time and carried with every request. This eliminates subdomain-based multi-tenancy complexity and ensures every authenticated request carries its own tenant identity.

### 5.4 Defense-in-Depth

Authentication is a three-layer defense:

1. **TenantMiddleware** — decodes JWT without verification, injects tenant context early
2. **JwtAuthGuard** — verifies JWT signature, loads user from DB, checks account status
3. **OnLeaveGuard** — blocks mutating operations for ON_LEAVE users

No single layer is trusted alone. The middleware does not verify signatures; the guards depend on the middleware for tenant context.

### 5.5 Credential Safety

- Passwords hashed with bcrypt (cost factor 12)
- Refresh tokens stored as bcrypt hashes (cost factor 10)
- Identical error messages for "user not found" and "wrong password" — prevents username enumeration
- `INACTIVE` and `SUSPENDED` users cannot authenticate at any layer

---

## 6. Authorization Architectural Principles

### 6.1 Three Complementary Layers

| Layer | Mechanism | Scope | Enforcement Point |
|-------|-----------|-------|-------------------|
| RBAC | Role enum on User | Coarse-grained route access | CASL ability factory |
| ABAC | CASL MongoAbility | Fine-grained resource conditions | CaslGuard + @CheckAbility() |
| State-Based | OnLeaveGuard | Operational safety (ON_LEAVE) | Global APP_GUARD |

### 6.2 Authorization Before Execution

Every mutation must pass through authorization **before** business logic executes:

```
Request → TenantMiddleware → JwtAuthGuard → OnLeaveGuard → CaslGuard → Controller → Service
```

Authorization failures must reject requests at the guard level, never inside service methods (except for resource-specific ownership checks).

### 6.3 Separation of Authentication and Authorization

Authentication answers "who is this?" Authorization answers "can they do this?" These are distinct concerns enforced by distinct components:

| Concern | Component | Failure |
|---------|-----------|---------|
| Authentication | JwtStrategy, JwtAuthGuard | 401 Unauthorized |
| Authorization | CaslGuard, OnLeaveGuard | 403 Forbidden |

### 6.4 Condition-Based Permissions

CASL supports MongoDB-style query conditions for fine-grained access control:

```typescript
can(Action.Update, 'Grade', { institutionId: user.institutionId });
```

This means: "user can update grades where the grade's institution matches the user's institution." Conditions are evaluated at runtime against the target resource's attributes.

### 6.5 Request-Scoped Authorization

Authorization context is per-request. The `CaslAbilityFactory.createForUser()` method builds a fresh `AppAbility` for every authenticated request. Abilities are never cached or reused across requests.

---

## 7. JWT Rules

### 7.1 JWT Payload Structure

```typescript
interface JwtPayload {
  sub: string;                       // userId (UUID)
  institutionId: string | null;      // null only for SUPER_ADMIN
  role: Role;                        // highest effective role
  email: string;
  status: UserStatus;                // ACTIVE | INACTIVE | SUSPENDED | ON_LEAVE
  leaveStartDate: string | null;    // ISO date, present when ON_LEAVE
  iat: number;
  exp: number;
}
```

### 7.2 JWT Validation Rules

- **Algorithm**: HS256 (symmetric, signed with JWT_SECRET for access tokens)
- **Verify every request**: JwtAuthGuard calls `passport-jwt` strategy which verifies signature + expiry
- **IgnoreExpiration: false** — expired tokens are rejected at the verification level
- **DB validation**: After signature verification, `JwtStrategy.validate()` loads the user from the database and checks `INACTIVE`/`SUSPENDED` status
- **Tenant consistency**: The `institutionId` in the JWT must match the user's DB record (verified implicitly by loading `req.user` from DB)

### 7.3 Access Token Lifecycle

| Phase | Detail |
|-------|--------|
| Generation | Issued on successful login or refresh. Signed with `JWT_SECRET`. |
| Payload | `sub`, `institutionId`, `role`, `email`, `status`, `leaveStartDate` |
| Expiry | 15 minutes (`JWT_EXPIRES_IN=15m`). Enforced by passport-jwt. |
| Storage | Client side only. **Never stored server-side.** |
| Propagation | `Authorization: Bearer <token>` header on every API request. |
| Revocation | Cannot be individually revoked (short TTL mitigates this). Mass revocation by changing `JWT_SECRET`. |

### 7.4 JWT Propagation in TenantMiddleware

`TenantMiddleware` calls `jwtService.decode()` (not `verify()`) to read the payload without signature verification. This is intentional and safe because:

- A malformed token leaves `req.institutionId` as `null`
- `JwtAuthGuard` subsequently verifies the signature and rejects invalid tokens
- No business logic executes before `JwtAuthGuard`

**Never change this to `verify()` in the middleware** — that would duplicate verification logic and create coupling between middleware and guard layers.

### 7.5 Forbidden JWT Patterns

| Forbidden Pattern | Risk |
|------------------|------|
| Storing sensitive data in JWT payload | JWT payloads are base64-encoded, not encrypted. Any data in the payload is readable by anyone with access to the token. |
| Trusting unsigned/unverified tokens | TenantMiddleware decodes only; JwtAuthGuard verifies. Never skip verification. |
| Bypassing JwtAuthGuard | Only `@Public()` decorator can bypass — and only for specific routes. |
| Exposing JWT payloads in logs | Logging `req.user` is acceptable; logging raw JWT strings is not. |
| Using access tokens for non-auth purposes | Access tokens carry identity, not authorization scope. Use CASL for permissions. |
| Storing access tokens in server-side sessions | EduSystem is stateless. Access tokens live client-side only. |
| Changing JWT TTL without architectural review | 15m/7d is a deliberate security tradeoff. Changes require documented justification. |

---

## 8. Refresh Token Rules

### 8.1 Refresh Token Architecture

Refresh tokens enable seamless UX without frequent re-authentication. Every refresh generates a **new token pair** and **revokes the old refresh token**. This is called **refresh token rotation**.

### 8.2 Rotation Flow

```
Client → POST /auth/refresh {refreshToken}
  → Server verifies JWT_REFRESH_SECRET signature
  → Server finds valid tokens for userId (revokedAt=null, expiresAt>now)
  → Server bcrypt.compare(refreshToken, stored tokenHash)
  → Server revokes old token (revokedAt = now())
  → Server generates new accessToken + new refreshToken
  → Server stores new refreshToken as bcrypt hash
  → Client receives {accessToken, refreshToken}
```

### 8.3 Refresh Token Storage Rules

| Rule | Implementation |
|------|---------------|
| Always hash | `bcrypt.hash(refreshToken, 10)` before storage. Never store plaintext. |
| Multi-device support | Each device gets its own refresh token. One token per client instance. |
| Expiry | 7 days (`JWT_REFRESH_EXPIRES_IN=7d`). Enforced at both JWT and DB level. |
| Revocation marker | `revokedAt: DateTime?` — set to `now()` on logout or rotation. |
| Device metadata | `deviceInfo: Json?` stores user-agent, IP for audit. Not used for device binding. |

### 8.4 Logout Behavior

```
POST /auth/logout {refreshToken}
  → Decode token (without verify) to get userId
  → Find valid tokens for userId
  → bcrypt.compare(refreshToken, stored hash)
  → Set revokedAt = now()
  → Return 204 (idempotent — even if token not found)
```

**Idempotency is critical**: already-revoked or nonexistent tokens return `204`, not `404`. This prevents information leakage about token validity.

### 8.5 Revocation Semantics

| Event | Impact |
|-------|--------|
| Logout (specific token) | Only that token revoked. Other devices remain active. |
| Token rotation | Old token revoked, new token issued. Single-use semantics. |
| User soft-delete | Cascade deletes all RefreshToken records. User cannot re-authenticate. |
| Mass revocation | Change `JWT_REFRESH_SECRET`. All existing refresh tokens become invalid. |

### 8.6 Forbidden Refresh Token Patterns

| Forbidden Pattern | Risk |
|------------------|------|
| Plaintext refresh token storage | Database compromise exposes all active tokens. Attacker can impersonate any user. |
| Reusable refresh tokens | Without rotation, a stolen token is valid until expiry. Rotation limits theft window. |
| Skipping bcrypt comparison | Always compare with `bcrypt.compare()`. Never compare hashes directly. |
| Bypassing `revokedAt` check | Every refresh must check `revokedAt = null`. A revoked token must never issue new tokens. |
| Storing refresh tokens in API logs | Log at the application level with `Logger`, never log raw token strings. |
| Exposing refresh tokens in responses beyond login/refresh | Only `POST /auth/login` and `POST /auth/refresh` return tokens. |
| Deleting expired tokens without archiving | Expired tokens can remain for audit. Remove only via explicit cleanup jobs. |

---

## 9. Session Security Rules

### 9.1 Server-Side Sessions

EduSystem maintains **no server-side sessions**. The API is fully stateless. All authentication state is carried in tokens.

### 9.2 Client-Side Session (NextAuth Bridge)

| Aspect | Detail |
|--------|--------|
| Frontend library | NextAuth v5 (beta) manages session persistence |
| Session storage | NextAuth JWT session cookie (separate from EduSystem API JWT) |
| Token forwarding | EduSystem `accessToken` and `refreshToken` stored in NextAuth session callbacks |
| Automatic refresh | When API returns 401, frontend calls NextAuth `update()` → `POST /auth/refresh` |
| Session polling | `refetchInterval={5 * 60}` keeps NextAuth session fresh |
| Cross-tab sync | NextAuth broadcast channel shares auth state across tabs |

### 9.3 Token Refresh Flow

```
1. Access token expires (15 min)
2. API returns 401
3. Frontend interceptor catches 401
4. Frontend calls POST /auth/refresh with stored refreshToken
5. Backend issues new accessToken + new refreshToken
6. Frontend updates NextAuth session
7. Original request retried with new accessToken
```

### 9.4 Concurrent Sessions

Multiple refresh tokens per user are supported (one per device). Each token is independently managed:
- Login on device A → creates refresh token A
- Login on device B → creates refresh token B
- Logout on device A → revokes only token A
- Device B remains authenticated

### 9.5 Session Expiry

| Condition | Behavior |
|-----------|----------|
| Access token expired | Refresh flow triggered (automatic on frontend) |
| Refresh token expired | 401 on refresh. User must re-authenticate. |
| Refresh token revoked | 401 on refresh. User must re-authenticate. |
| Refresh token rotated | Old token invalid. User must re-authenticate if they lost the new token. |
| User deleted (soft) | Cascade delete removes all refresh tokens. 401 on next request. |
| User status changed to INACTIVE/SUSPENDED | JwtStrategy.validate() rejects. 401 on next request. |

### 9.6 Session Security Rules

- Access tokens must never be stored server-side
- Refresh tokens must never be logged
- The backend single source of truth for session validity is the `RefreshToken` table
- Frontend session state is a UX optimization, not a security enforcement point
- `ON_LEAVE` status blocks mutations at the guard level — frontend UI gating is secondary

---

## 10. CASL Authorization Rules

### 10.1 CASL Architecture

EduSystem uses `@casl/ability` with `createMongoAbility` for condition-based authorization. Permissions are evaluated at runtime based on the user's effective role and the target resource's attributes.

### 10.2 Ability Factory

`CaslAbilityFactory.createForUser(user)` builds a fresh `AppAbility` for every request:

```typescript
async createForUser(user: RequestUser): Promise<AppAbility> {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  const levelRoles = await this.prisma.userLevelRole.findMany({
    where: { userId: user.id }, select: { role: true },
  });
  const allRoles = [user.role, ...levelRoles.map((lr) => lr.role)];
  const effectiveRole = getHighestRole(allRoles);

  switch (effectiveRole) {
    case 'SUPER_ADMIN':
      can(Action.Manage, 'all');
      break;
    case 'TEACHER':
      can(Action.Read, 'all', { institutionId: user.institutionId });
      can([Action.Create, Action.Update, Action.Delete], 'Grade', {
        institutionId: user.institutionId,
      });
      break;
    // ... per-role rules
  }

  return build();
}
```

### 10.3 Subject Registry

CASL subjects registered in the factory:

```typescript
type Subjects =
  | 'Institution' | 'User' | 'Student' | 'Course'
  | 'Subject' | 'Grade' | 'Attendance' | 'Announcement'
  | 'Convivencia' | 'Space' | 'SpaceReservation'
  | 'Sport' | 'SportGroup' | 'all';
```

When adding a new model that needs ABAC enforcement, register it in the subject type **and** in the ability factory's per-role rules.

### 10.4 Condition-Based Rules

CASL conditions are MongoDB-style query objects evaluated against the target resource:

```typescript
can(Action.Update, 'Grade', { institutionId: user.institutionId });
can(Action.Read, 'Student', { institutionId: user.institutionId });
```

Conditions can reference:
- Direct resource properties (`institutionId`, `authorId`)
- Nested relations (`course.institutionId`) — supported via CASL's `conditions` matcher
- Dynamic values from `user` context (`user.institutionId`, `user.id`)

### 10.5 Effective Role Resolution

The effective role for CASL is the **highest role** among:
- `User.role` (base role)
- All `UserLevelRole.role` entries (per-level roles)

```typescript
const allRoles = [user.role, ...levelRoles.map((lr) => lr.role)];
const effectiveRole = getHighestRole(allRoles);
```

**Important**: `getHighestRole()` uses the role hierarchy:
```
SUPER_ADMIN > ADMIN > DIRECTOR > SECRETARY > PRECEPTOR > TEACHER > GUARDIAN
```

### 10.6 Permission Enforcement Points

| Point | Mechanism | What It Enforces |
|-------|-----------|------------------|
| Controller route | `@CheckAbility({ action, subject })` | Action-level permission for the subject |
| Controller class | `@UseGuards(CaslGuard)` on class | All routes in controller require CASL |
| Service method | Manual `ability.can()` check | Resource-specific conditions (rare, used only for complex ownership) |

### 10.7 Forbidden CASL Patterns

| Forbidden Pattern | Risk |
|------------------|------|
| Bypassing `@CheckAbility()` | Route is unprotected. Any authenticated user can access it. |
| Implicit authorization (no decorator) | All controller routes must have explicit `@CheckAbility()` or a justification comment. |
| Trusting frontend role values | Roles must come from `req.user` (DB-backed), never from request body or query params. |
| Permission logic inside controllers | `@CheckAbility()` is declarative. Complex permission logic belongs in the ability factory. |
| Inconsistent subject names | Subject names must match the registered type exactly. `'Grade'` not `'grade'` or `'Grades'`. |
| Skipping `CaslGuard` on controller | Every controller with `@CheckAbility()` must have `@UseGuards(CaslGuard)`. |

---

## 11. Role & Permission Rules

### 11.1 Role Hierarchy

```
SUPER_ADMIN > ADMIN > DIRECTOR > SECRETARY > PRECEPTOR > TEACHER > GUARDIAN
```

Roles are strictly ordered from most to least privileged. The effective role is always the highest in this hierarchy.

### 11.2 Role Assignment

| Role | Can Be Set By | Scope |
|------|--------------|-------|
| SUPER_ADMIN | Database only (cannot be set via API) | Platform-wide, no institution |
| ADMIN | SUPER_ADMIN | Institution-scoped |
| DIRECTOR | SUPER_ADMIN, ADMIN | Institution-scoped |
| SECRETARY | SUPER_ADMIN, ADMIN, DIRECTOR | Institution-scoped |
| PRECEPTOR | SUPER_ADMIN, ADMIN, DIRECTOR | Institution-scoped |
| TEACHER | SUPER_ADMIN, ADMIN, DIRECTOR, SECRETARY | Institution-scoped |
| GUARDIAN | Self (via invitation) or ADMIN/DIRECTOR | Institution-scoped |

### 11.3 Per-Level Roles (UserLevelRole)

Users can hold different roles per educational level (`INICIAL`, `PRIMARIA`, `SECUNDARIA`):

```prisma
model UserLevelRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  level     Level    // INICIAL | PRIMARIA | SECUNDARIA
  role      Role     // TEACHER | PRECEPTOR | etc.
  createdAt DateTime @default(now()) @map("created_at")
  @@unique([userId, level, role])
  @@index([userId])
}
```

**Critical rule**: After any `UserLevelRole` mutation, `syncHighestRole()` must be called on the `User` record to ensure the base `User.role` reflects the effective role. This is necessary because the JWT payload carries `role` from `User.role`, not from `UserLevelRole`.

### 11.4 Permission Matrix

| Role | Institution | User | Student | Course | Grade | Attendance | Announcement | Convivencia |
|------|-------------|------|---------|--------|-------|------------|--------------|-------------|
| SUPER_ADMIN | Manage all | Manage all | Manage all | Manage all | Manage all | Manage all | Manage all | Manage all |
| ADMIN | Manage | Manage | Manage | Manage | Manage | Manage | Manage | Manage |
| DIRECTOR | Manage | Manage | Manage | Manage | Manage | Manage | Manage | Manage |
| SECRETARY | Read | Read/Create | Manage | Manage | Read | Read | Manage | Read |
| PRECEPTOR | Read | Read | Manage | Read | Read | Manage | Manage | Manage |
| TEACHER | — | Update self | Read | Read | CRUD own | Create/Update own | CRUD own | Read |
| GUARDIAN | — | — | Read own children | Read | Read own children | Read own children | Read | Read own children |

### 11.5 Role Modification Rules

- `SUPER_ADMIN` role can **never** be granted via API. It is set directly in the database only.
- A user cannot promote themselves or others to a role equal to or higher than their own.
- Role changes must dispatch an `audit.log` job.
- When a role changes, existing JWT access tokens remain valid until expiry (15 min max). The next refresh will pick up the new role from the DB.

---

## 12. Guard Rules

### 12.1 Guard Execution Order

```
1. TenantMiddleware (Express middleware)
2. JwtAuthGuard (APP_GUARD — global)
3. OnLeaveGuard (APP_GUARD — global)
4. CaslGuard (per-controller via @UseGuards(CaslGuard))
```

This ordering is enforced by NestJS module registration. **Never change this order** or remove a global guard.

### 12.2 JwtAuthGuard (Global)

| Property | Value |
|----------|-------|
| Registration | `{ provide: APP_GUARD, useClass: JwtAuthGuard }` in AuthModule |
| Bypass | `@Public()` decorator on handler or class |
| Verification | `passport-jwt` strategy: signature + expiry check |
| Validation | `JwtStrategy.validate()`: DB lookup, INACTIVE/SUSPENDED check |
| Failure | 401 Unauthorized |

**Behavior**:
- If `@Public()` is present, skip authentication entirely
- If `@Public()` is absent, verify JWT signature and expiry
- After verification, load user from DB and populate `req.user`
- Reject `INACTIVE` and `SUSPENDED` users

### 12.3 OnLeaveGuard (Global)

| Property | Value |
|----------|-------|
| Registration | `{ provide: APP_GUARD, useClass: OnLeaveGuard }` in AppModule |
| Bypass | `@SkipLeaveCheck()` decorator; exempt paths (`/auth/*`, `/password`, `/leave`, `/restore`) |
| Source of truth | Reads JWT directly from `Authorization` header (not `req.user`) |
| Blocked methods | POST, PUT, PATCH, DELETE |
| Allowed methods | GET, HEAD, OPTIONS |
| Failure | 403 Forbidden |

**Why read JWT directly from header**: `APP_GUARD` execution order is not strictly guaranteed by NestJS. If `OnLeaveGuard` executes before `JwtAuthGuard`, `req.user` would be undefined. By self-contained JWT decoding, `OnLeaveGuard` eliminates this dependency.

**Exempt paths**:
- `/auth/login` — login must work for all users
- `/auth/logout` — logout must work for all users
- `/auth/refresh` — token refresh must work for all users
- `/users/:id/password` — password change must work for all users
- `/users/:id/leave` — leave management endpoints
- `/users/:id/restore` — leave revocation endpoints

### 12.4 CaslGuard (Per-Controller)

| Property | Value |
|----------|-------|
| Registration | `@UseGuards(CaslGuard)` on each controller (not global) |
| Bypass | Absence of `@CheckAbility()` on the route handler |
| Enforcement | Builds `AppAbility` via factory, checks against `@CheckAbility()` metadata |
| Failure | 403 Forbidden |

**Every controller** with authorization requirements must:
1. Have `@UseGuards(CaslGuard)` on the class
2. Have `@CheckAbility({ action, subject })` on each route handler

### 12.5 Global Guard Safety Rules

- Never remove `JwtAuthGuard` or `OnLeaveGuard` from `APP_GUARD` providers
- Never add new global guards without architectural review
- Never add routes to the exempt path list without explicit justification
- Never use `@Public()` on a route that handles sensitive data without documenting why
- `@Public()` bypasses `JwtAuthGuard` only — it does NOT bypass `OnLeaveGuard` or `CaslGuard`

---

## 13. Tenant-Aware Authorization Rules

### 13.1 Tenant Context Flow

```
Client Request (Bearer JWT)
  → TenantMiddleware: jwt.decode() → extract institutionId
  → req.institutionId = payload.institutionId ?? null
  → JwtAuthGuard: verify signature → load user from DB
  → req.user = { id, email, role, institutionId, status }
  → CaslGuard: build ability → check @CheckAbility() permissions
  → Controller: @InstitutionId() extracts req.institutionId
  → Service: filters all queries by institutionId
```

### 13.2 institutionId in JWT

The `institutionId` in the JWT payload is set at token generation time. It comes from `User.institutionId` in the database. If a user's `institutionId` changes, their next token reflects the change (existing tokens retain old value until expiry — 15 min max).

### 13.3 Cross-Tenant Authorization Rules

| Scenario | Rule |
|----------|------|
| Service A queries data for Institution X | Must filter by `institutionId = X` |
| Service A receives a UUID from client | Must validate the referenced entity belongs to `institutionId` |
| SUPER_ADMIN queries all institutions | Explicit bypass with `if (user.role !== 'SUPER_ADMIN')` guard |
| Job processor reads data | Uses `institutionId` from job payload (not from JWT) |

### 13.4 Cross-Entity Tenant Validation

Before creating or updating data that references another entity, validate the referenced entity belongs to the same tenant:

```typescript
const courseSubject = await this.prisma.courseSubject.findFirst({
  where: { id: dto.courseSubjectId, course: { institutionId } },
});
if (!courseSubject) {
  throw new BadRequestException('La materia no existe o no pertenece a la institución');
}
```

### 13.5 Forbidden Tenant-Aware Auth Patterns

| Forbidden Pattern | Risk |
|------------------|------|
| Accepting `institutionId` from request body | Client could specify a different tenant's ID. Must come from JWT. |
| Querying tenant-scoped models without `institutionId` filter | Cross-tenant data leak |
| Trusting `req.params.id` as a tenant identifier | IDs are UUIDs — a user from tenant A could guess tenant B's IDs |
| Bypassing tenant validation in service layer | All service methods taking IDs must validate tenant ownership |

---

## 14. SUPER_ADMIN Rules

### 14.1 Identity

`SUPER_ADMIN` is a platform-level role with `institutionId = null`. There is no `UserLevelRole` for `SUPER_ADMIN` — it is always the base `User.role`.

```prisma
model User {
  id            String     @id @default(uuid())
  institutionId String?    @map("institution_id")  // null for SUPER_ADMIN only
  role          Role       @default(TEACHER)
  // ...
  @@unique([email, institutionId])
}
```

### 14.2 CASL Bypass

```typescript
case 'SUPER_ADMIN': {
  can(Action.Manage, 'all');  // Full access — all subjects, all tenants
  break;
}
```

`SUPER_ADMIN` bypasses all tenant isolation and all subject-level restrictions.

### 14.3 Service Layer Bypass

```typescript
async findOne(id: string, user: RequestUser) {
  if (user.role !== 'SUPER_ADMIN') {
    const course = await this.prisma.course.findFirst({
      where: { id, institutionId: user.institutionId },
    });
    if (!course) throw new NotFoundException();
    return course;
  }
  return this.prisma.course.findUnique({ where: { id } });
}
```

Every tenant-aware query that has a SUPER_ADMIN bypass must use the explicit pattern: check role first, then conditionally apply institutionId filter.

### 14.4 SUPER_ADMIN Safety Rules

| Rule | Rationale |
|------|-----------|
| SUPER_ADMIN can never be granted via API | Prevents privilege escalation by compromised admin accounts |
| SUPER_ADMIN bypass must be explicit | `if (role !== SUPER_ADMIN)` — never implicit "return everything" |
| SUPER_ADMAN should be used sparingly | Most operations should use institution-scoped roles |
| SUPER_ADMIN actions must be audited | Every mutation by SUPER_ADMIN must generate an audit log |
| Email uniqueness enforced by partial index | `CREATE UNIQUE INDEX ... WHERE institution_id IS NULL` prevents duplicate SUPER_ADMIN emails |

### 14.5 Forbidden SUPER_ADMIN Patterns

| Forbidden Pattern | Risk |
|------------------|------|
| Hardcoding SUPER_ADMIN email or ID in code | Creates backdoor access |
| Implicit SUPER_ADMIN bypass (no role check) | Non-SUPER_ADMIN users could accidentally bypass tenant isolation |
| Exposing SUPER_ADMAN API surface to non-SUPER_ADMIN users | Privilege escalation |
| SUPER_ADMIN role in UserLevelRole | SUPER_ADMIN must only exist as `User.role`, never as a per-level role |

---

## 15. Request Context Rules

### 15.1 Decorator Chain

| Decorator | Source | Return Type | Purpose |
|-----------|--------|-------------|---------|
| `@InstitutionId()` | `req['institutionId']` (set by TenantMiddleware) | `string \| null` | Tenant context for service queries |
| `@CurrentUser()` | `req['user']` (set by JwtAuthGuard) | `RequestUser` | Full authenticated user object |
| `@Public()` | Metadata flag | `boolean` (guard bypass) | Bypass JwtAuthGuard on specific routes |

### 15.2 RequestUser Interface

```typescript
interface RequestUser {
  id: string;
  email: string;
  role: Role;
  institutionId: string | null;
  status: UserStatus;
  leaveStartDate: string | null;
}
```

### 15.3 Context Propagation Rules

- `@InstitutionId()` must be used on every tenant-scoped controller method
- `@CurrentUser()` must be used when service methods need the caller's identity
- The `institutionId` from `@InstitutionId()` and `req.user.institutionId` must always match
- Service-to-service calls must pass `institutionId` explicitly — there is no thread-local context

### 15.4 Forbidden Context Patterns

| Pattern | Risk |
|---------|------|
| Accessing `req` directly in service methods | Breaks testability and couples services to HTTP layer |
| Passing `institutionId` from request body | Client could falsify tenant context |
| Caching `institutionId` in module-level variables | Cross-request state leak between tenants |

---

## 16. Authentication Database Rules

### 16.1 RefreshToken Model

```prisma
model RefreshToken {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  tokenHash  String    @map("token_hash") @db.VarChar(512)
  deviceInfo Json?     @map("device_info")
  expiresAt  DateTime  @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")
  createdAt  DateTime  @default(now()) @map("created_at")
}
```

| Field | Rule |
|-------|------|
| `tokenHash` | Must always contain a bcrypt hash. **Never plaintext.** |
| `expiresAt` | Set to `now() + 7 days` on creation. Checked on every refresh. |
| `revokedAt` | `null` = active. Set to `now()` on logout or rotation. |
| `userId` | FK to User. Cascade on user soft-delete. |

### 16.2 Password Hashing

| Rule | Detail |
|------|--------|
| Algorithm | `bcryptjs` with cost factor 12 |
| Storage | `User.passwordHash` field |
| Comparison | Always `bcrypt.compare(plaintext, hash)` |
| Update | Requires current password verification |
| Reset flow | Not implemented (admin creates user with temporary password) |

### 16.3 Credential Safety Rules

- **Never** log password hashes, plaintext passwords, or password comparison results
- **Never** return password hashes in API responses
- **Never** accept plaintext passwords in non-auth endpoints
- **Never** compare passwords outside of `AuthService`
- **Always** use identical error messages for "user not found" and "wrong password"

### 16.4 Token Cleanup

Expired refresh tokens are not automatically cleaned up. When implementing cleanup:

- Remove tokens where `expiresAt < now() - 30 days` AND `revokedAt IS NOT NULL`
- Run as a scheduled BullMQ job (not a cron job) — do not block API paths
- Log count of removed tokens for observability

---

## 17. Security Rules

### 17.1 Least Privilege

- Access tokens carry minimal payload: identity + tenant context. No permission data.
- Refresh tokens are single-purpose: issue new access tokens. Cannot access API resources.
- CASL abilities are built per-request: no cached or reused permissions.
- Users receive the minimum set of permissions for their role.

### 17.2 Secure Defaults

| Default | Rationale |
|---------|-----------|
| All routes require authentication | `JwtAuthGuard` is global. New routes are protected by default. |
| All mutations require authorization | `@CheckAbility()` must be on every route. |
| `ON_LEAVE` blocks all mutations | `OnLeaveGuard` is global. New mutating endpoints are blocked by default for leave users. |
| Public routes are exceptions | `@Public()` must be explicitly added. |

### 17.3 Brute Force Protection (Not Implemented)

| Control | Status | Priority |
|---------|--------|----------|
| `@nestjs/throttler` on `/auth/login` | Not implemented | High |
| `@nestjs/throttler` on `/auth/refresh` | Not implemented | Medium |
| Account lockout after N failed attempts | Not implemented | Medium |
| Progressive delay on repeated failures | Not implemented | Low |

**When implementing**: Throttling must be tenant-aware (per-IP and per-user within a tenant). Lockout must be persisted and expireable.

### 17.4 Security Response Rules

| Attack Vector | Mitigation |
|---------------|-----------|
| Credential stuffing | Identical error messages prevent username enumeration |
| Token replay | Short TTL (15m) + refresh token rotation |
| Token theft (DB read) | Refresh tokens are bcrypt-hashed — attacker cannot use them |
| Token theft (intercept) | Access token valid 15 min max. Refresh token rotated on use. |
| CSRF | No session cookies. Bearer tokens. CORS whitelist enforced. |
| XSS (token access) | Tokens in HttpOnly cookies (frontend), not accessible via JS. |
| Privilege escalation | `SUPER_ADMIN` role cannot be granted via API. CASL checks at controller level. |

### 17.5 Secure Error Exposure

- Never expose stack traces in production auth errors
- Never reveal whether an email is registered (use identical messages for invalid user/password)
- Never reveal token hash structure or hashing algorithm in error messages
- Never differentiate between "token expired" and "token invalid" in production error messages

---

## 18. Audit Logging Rules

### 18.1 Auth Events That Must Be Audited

| Event | Action | Payload |
|-------|--------|---------|
| Successful login | LOGIN | `{ userId, institutionId, ipAddress, userAgent }` |
| Failed login | LOGIN (failure) | `{ email, institutionId?, ipAddress, userAgent }` |
| Logout | LOGOUT | `{ userId, institutionId, tokenId }` |
| Token refresh | UPDATE | `{ userId, institutionId, oldTokenId, newTokenId }` |
| Role change | UPDATE | `{ userId, institutionId, before: { role }, after: { role } }` |
| User status change | UPDATE | `{ userId, institutionId, before: { status }, after: { status } }` |
| User soft-delete | DELETE | `{ userId, institutionId }` |
| Permission change | UPDATE | `{ role, action, resource, before, after }` |

### 18.2 Audit Rules

| Rule | Rationale |
|------|-----------|
| Audit logs are async (BullMQ) | Never block the auth response for audit persistence |
| Audit payloads must never contain secrets | No passwords, no tokens, no hashes |
| Audit logs must include `institutionId` | Enables tenant-scoped audit queries |
| Audit for auth failures must include source IP | Enables security incident investigation |
| Audit for role/status changes must include before/after | Enables rollback decisions |

### 18.3 Forbidden Audit Patterns

| Pattern | Risk |
|---------|------|
| Including plaintext passwords in audit data | Credential exposure |
| Including raw JWT strings in audit data | Token theft via audit log access |
| Synchronous audit writes in auth paths | Blocks login/refresh response |
| Skipping audit on auth failures | Blind spot for brute-force detection |

---

## 19. Queue & Worker Auth Rules

### 19.1 Auth Context in Workers

Workers (BullMQ processors) do **not** have access to the HTTP request context or JWT. They operate with tenant context provided explicitly in job payloads:

```typescript
await this.notificationQueue.add(JOBS.GRADE_CREATED, {
  gradeId: grade.id,
  studentId: dto.studentId,
  institutionId,  // Explicit tenant context — required on every job
}, JOB_OPTIONS.DEFAULT);
```

### 19.2 Worker Tenant Propagation Rules

- Every job payload must include `institutionId` as a required field
- Workers never decode a JWT — they receive tenant context as structured data
- Workers are completely stateless and tenant-agnostic
- Job data is the sole source of truth for tenant identity in workers

### 19.3 Auth-Related Jobs

| Job | Purpose | Sensitive Data | Rule |
|-----|---------|---------------|------|
| `audit.log` | Persist audit records | Yes (userId, action) | Never include tokens or passwords |
| `grade.created` notification | Push notification | No | Standard grade data only |

### 19.4 Forbidden Queue Auth Patterns

| Pattern | Risk |
|---------|------|
| Queueing raw credentials (passwords, tokens) | Redis compromise exposes auth secrets |
| Queueing plaintext JWT tokens | Token theft via queue monitoring |
| Using worker to authenticate users | Auth must happen synchronously in the API layer |
| Propagating JWT into worker context | Workers have no JWT verification capability |

---

## 20. Error Handling Rules

### 20.1 Authentication Error Semantics

| Error | HTTP Status | Message | When |
|-------|-------------|---------|------|
| Missing/expired JWT | 401 Unauthorized | Generic auth error | JwtAuthGuard rejection |
| Invalid signature | 401 Unauthorized | Generic auth error | JWT verification failure |
| INACTIVE/SUSPENDED user | 401 Unauthorized | "Tu cuenta está inactiva o suspendida" | JwtStrategy rejection |
| Invalid credentials | 401 Unauthorized | "Credenciales inválidas" | Login failure (same for user-not-found) |
| Token refresh failure | 401 Unauthorized | Generic refresh error | Refresh token expired/revoked/invalid |

### 20.2 Authorization Error Semantics

| Error | HTTP Status | Message | When |
|-------|-------------|---------|------|
| CASL permission denied | 403 Forbidden | "No tenés permiso para realizar esta acción" | CaslGuard rejection |
| ON_LEAVE mutation blocked | 403 Forbidden | "Tu cuenta está en licencia y no puede realizar modificaciones" | OnLeaveGuard rejection |
| Cross-tenant access | 404 Not Found | Generic "not found" | Service-level tenant validation (don't reveal existence) |

**Security Rule for Cross-Tenant Errors**: When a resource belongs to a different tenant, return `404 Not Found`, not `403 Forbidden`. This prevents attackers from enumerating valid resource IDs across tenants.

### 20.3 Validation Error Semantics

| Error | HTTP Status | Message | When |
|-------|-------------|---------|------|
| Zod validation failure | 400 Bad Request | Per-field error array | LoginSchema, RefreshSchema validation |
| Missing required field | 400 Bad Request | Field-level message | DTO validation |

### 20.4 Safe Error Exposure

| Rule | Rationale |
|------|-----------|
| Never expose stack traces in auth errors | Prevents information leakage about application internals |
| Never differentiate "user not found" from "wrong password" | Prevents username enumeration |
| Never expose details about refresh token state | Prevents token structure analysis |
| Never include SQL errors in auth responses | Prevents database structure leakage |
| Always log the full error server-side | Enables debugging without exposing details to clients |

---

## 21. Performance & Scalability Rules

### 21.1 Stateless Authentication

The auth architecture is designed for horizontal scaling:

- No server-side sessions to synchronize across instances
- JWT validation is CPU-only (no DB lookup for signature verification)
- Refresh token lookup is the only DB-bound auth operation (bcrypt compare + token fetch)

### 21.2 Efficient CASL Ability Building

`createForUser()` performs one DB query (`findMany` on `UserLevelRole`). This is acceptable for per-request invocation:

- Query is indexed on `userId`
- Most users have 0-3 `UserLevelRole` entries
- The ability object is not cached (abilities change rarely but must be fresh)

**Do not cache abilities** — a stale ability could grant permissions after a role change.

### 21.3 Async Audit Logging

Auth audit events are dispatched via BullMQ (async). This means:

- Login/refresh/logout response times are not affected by audit DB writes
- Audit failures do not block authentication
- Redis failure would lose audit events but not prevent authentication

### 21.4 Scalability Boundaries

| Component | Scalability Model | Constraint |
|-----------|------------------|------------|
| JwtAuthGuard | Per-instance stateless | None — scales with API instances |
| OnLeaveGuard | Per-instance stateless | None — self-contained JWT decode |
| CaslAbilityFactory | Per-request DB-backed | Scales with Prisma connection pool |
| RefreshToken table | Single DB table | `tokenHash` index for bcrypt compare |
| Auth endpoints | Stateless HTTP | No rate limiting currently |

### 21.5 Future Auth Scaling Considerations

- If login volume exceeds 100 req/s, consider read replica for credential lookup
- If refresh volume exceeds 500 req/s, consider Redis-based token cache (with invalidation)
- If bulk token revocation is needed, implement Redis-backed token blacklist

---

## 22. Preferred Patterns

| Pattern | Description | Why |
|---------|-------------|-----|
| Guard-based authentication | JwtAuthGuard handles all auth enforcement at the gate | Centralized, consistent, fail-safe |
| Service-layer authorization | Authorization logic in CaslAbilityFactory, not in services | Testable, declarative, auditable |
| Explicit permission checks | `@CheckAbility()` on every route | No implicit trust, self-documenting |
| Hashed token storage | bcrypt for both passwords and refresh tokens | Database compromise resistance |
| Request-scoped auth context | Fresh `AppAbility` per request, `@InstitutionId()` for tenant | No cross-request state leaks |
| Tenant-aware CASL rules | Conditions scoped by `institutionId` | Defense-in-depth for multi-tenancy |
| Explicit auth flows | Login → tokens → guard → service: clear separation | Debuggable, auditable, maintainable |
| Audit-aware sensitive actions | Every auth event generates an audit log | Security incident response capability |
| Self-contained guards | OnLeaveGuard reads JWT directly from header | Eliminates execution order dependency |
| Dual signing keys | Separate JWT_SECRET and JWT_REFRESH_SECRET | Isolates access token from refresh token compromise |

---

## 23. Forbidden Patterns

### 23.1 Critical Violations (Blocking for PR Approval)

| Pattern | Risk | Detection |
|---------|------|-----------|
| Plaintext token storage in DB | Database compromise exposes all active tokens | grep for `tokenHash` assignment without `bcrypt.hash` |
| Bypassing JwtAuthGuard without @Public() | Route becomes accessible without authentication | Review for `canActivate` overrides |
| Bypassing CaslGuard | Route becomes accessible without authorization | Review for missing `@UseGuards(CaslGuard)` |
| Trusting client-provided roles or permissions | Privilege escalation | grep for role/permission from request body |
| Hardcoded SUPER_ADMIN identifiers | Backdoor access | Static analysis of role checks |
| Mixing auth decisions with business logic | Unclear responsibility, hard to audit | Service methods should not make auth decisions |
| Skipping audit for auth events | Blind spot for incident response | grep for auth actions without audit dispatch |

### 23.2 High Severity Violations

| Pattern | Risk | Detection |
|---------|------|-----------|
| Caching CASL abilities across requests | Stale permissions after role change | Static analysis of ability factory |
| Passing institutionId from request body | Tenant ID spoofing | grep for `institutionId` from `@Body()` |
| Using `any` for auth-related types | Type safety violation, potential injection | TypeScript compiler checks |
| Logging raw JWT strings | Token theft via log access | grep for JWT string in logger calls |
| Exposing password hashes in API responses | Credential exposure | Review serialization of User model |
| Reusable refresh tokens (no rotation) | Token theft window extends to 7 days | Review refresh endpoint logic |
| Global guard bypass without documentation | Silent auth bypass | Review @Public() and @SkipLeaveCheck() usage |

### 23.3 Medium Severity Violations

| Pattern | Risk | Detection |
|---------|------|-----------|
| Non-tenant-aware permission checks | Cross-tenant data access | grep for `can()` without `institutionId` condition |
| Async/await on audit dispatch in auth path | Increased login latency | Review audit dispatch pattern |
| Missing `revokedAt` check in refresh | Revoked tokens can still issue new tokens | Review refresh endpoint logic |
| Insufficient error differentiation | Username enumeration or ID enumeration | Review error message patterns |
| Stale JWT_SECRET or predictable secret | Token forgery possibility | Review config validation |

---

## 24. Development Workflow Expectations

### 24.1 Before Modifying Auth Code

1. **Read all required context** — documents listed in section 4 of this guide
2. **Analyze existing auth flows** — trace the full request lifecycle for the affected endpoints
3. **Identify constraint chain** — understand which guards, middleware, and CASL rules apply
4. **Document the planned change** — explain the reasoning in the PR description

### 24.2 During Implementation

| Rule | Rationale |
|------|-----------|
| Preserve backward compatibility | Existing tokens, sessions, and permissions must continue working |
| Avoid introducing auth inconsistencies | New patterns must match existing auth architecture |
| Preserve security guarantees | JWT validation, token hashing, CASL enforcement must remain intact |
| Explain auth-impacting changes in PR | Complex auth logic requires human review |
| Avoid speculative auth abstractions | Build what is needed now, not what might be needed later |
| Preserve architectural consistency | Follow existing patterns (guard-based, CASL-based, tenant-aware) |

### 24.3 When to Request Architectural Review

Any change that:

- Adds or removes a global guard
- Modifies JWT signing strategy (algorithm, key rotation)
- Changes token TTLs
- Modifies CASL ability factory logic
- Adds new authentication mechanisms (OAuth, MFA, SSO)
- Changes refresh token rotation logic
- Modifies TenantMiddleware behavior
- Adds new exempt paths for OnLeaveGuard

Requires documented rationale and explicit approval before implementation.

### 24.4 Testing Expectations

| Test Category | Auth Coverage Target |
|---------------|---------------------|
| JWT validation | Valid token, expired token, invalid signature, malformed token |
| Refresh token lifecycle | Issue, refresh (rotation), logout (revocation), expired token, revoked token |
| CASL enforcement | Each action/subject pair, condition evaluation, role hierarchy |
| Guard behavior | Ordering, @Public() bypass, @SkipLeaveCheck(), ON_LEAVE blocking |
| Tenant-aware auth | Cross-tenant access rejection, tenant-scoped ability building |
| SUPER_ADMIN bypass | Full access across tenants, audit logging of SUPER_ADMIN actions |
| Error handling | Secure error messages, identical messages for user-not-found vs wrong-password |

---

## 25. Validation Checklist

Before submitting any auth-related code change, verify all items:

### 25.1 Authentication

- [ ] JWT validation remains secure (signature + expiry + DB user lookup)
- [ ] Refresh tokens remain bcrypt-hashed before storage
- [ ] Refresh token rotation is preserved (old token revoked on each refresh)
- [ ] `revokedAt` check is applied on every refresh request
- [ ] Login error messages do not differentiate "user not found" from "wrong password"
- [ ] INACTIVE and SUSPENDED users cannot authenticate
- [ ] ON_LEAVE users can authenticate but mutations are blocked

### 25.2 Authorization

- [ ] CASL `@CheckAbility()` is present on every controller route (or justified with comment)
- [ ] `CaslGuard` is applied on every controller with `@CheckAbility()`
- [ ] Tenant-aware conditions (`institutionId: user.institutionId`) are present on all tenant-scoped abilities
- [ ] No implicit authorization — every route has explicit permission metadata
- [ ] No authorization logic in controllers — declarative decorators only

### 25.3 Guards

- [ ] `JwtAuthGuard` remains global (APP_GUARD)
- [ ] `OnLeaveGuard` remains global (APP_GUARD)
- [ ] Guard execution order is preserved: TenantMiddleware → JwtAuthGuard → OnLeaveGuard → CaslGuard
- [ ] No new routes are exempted from OnLeaveGuard without documented justification
- [ ] `@Public()` is not used on routes that handle sensitive data
- [ ] OnLeaveGuard still reads JWT directly from `Authorization` header (not `req.user`)

### 25.4 Tenant Awareness

- [ ] All tenant-scoped queries include `institutionId` filter
- [ ] Cross-entity references are validated to belong to the same tenant
- [ ] `@InstitutionId()` is used on all tenant-scoped controller methods
- [ ] `institutionId` is never accepted from request body or query params
- [ ] SUPER_ADMIN bypass is explicit (`if (role !== SUPER_ADMIN)`) with scoped else

### 25.5 Security

- [ ] No privilege escalation paths exist
- [ ] No auth bypass paths exist
- [ ] No sensitive data leaks (passwords, tokens, hashes in logs, responses, or errors)
- [ ] Session invalidation works correctly (token revocation, user deactivation)
- [ ] No secrets or credentials in code or configuration
- [ ] Cross-tenant resource access returns 404, not 403

### 25.6 Audit & Observability

- [ ] All auth events (login, logout, refresh) dispatch audit log jobs
- [ ] All role changes and status changes dispatch audit log jobs
- [ ] Audit payloads do not contain secrets (passwords, tokens, hashes)
- [ ] All auth errors are logged server-side

### 25.7 Architectural Integrity

- [ ] No new global guards added
- [ ] No architectural drift — changes follow existing auth patterns
- [ ] Token TTLs unchanged (or documented justification provided)
- [ ] JWT signing strategy unchanged (or documented justification provided)
- [ ] No speculative abstractions — changes address current requirements only

---

## 26. Expected Quality Standards

### 26.1 Zero-Tolerance Violations

The following constitute **immediate PR rejection** and must be fixed before merge:

- Authentication bypass vulnerability
- Authorization bypass vulnerability  
- Cross-tenant data leak
- Plaintext credential storage
- Privilege escalation path

### 26.2 Quality Gates

| Gate | Standard |
|------|----------|
| Test coverage | All auth flows have unit tests (login, refresh, logout, guard behavior, CASL rules) |
| Type safety | No `any` in auth-related code. All DTOs have Zod schemas. |
| Security | No secrets in code. No hardcoded credentials. No logging of sensitive data. |
| Consistency | Follows existing auth patterns. No new anti-patterns introduced. |
| Documentation | Auth-impacting changes documented in PR description with migration notes. |

### 26.3 Review Requirements

Every auth-related PR must be reviewed with attention to:

1. **Security invariants** — are all auth guarantees preserved?
2. **Tenant isolation** — does the change respect institution boundaries?
3. **Backward compatibility** — do existing tokens, sessions, and permissions continue working?
4. **Test coverage** — are new auth flows properly tested?
5. **Documentation** — are architecture docs updated to reflect changes?

---

*This document is the authoritative security and operational guide for AI agents modifying authentication and authorization functionality within the EduSystem repository. It is maintained alongside the codebase and updated whenever auth architecture rules change.*

*For questions or security concerns, contact the architecture team. For suspected security vulnerabilities, escalate immediately to the platform security team.*
