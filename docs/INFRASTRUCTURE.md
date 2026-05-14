# EduSystem — Infrastructure & Deployment Architecture

> **Version:** 2.1  
> **Last Updated:** 2026-05-14  
> **Classification:** Internal Technical Documentation  
> **Audience:** DevOps Engineers, Backend Developers, Platform Engineers, Cloud Architects, AI Coding Agents, Future Maintainers

---

## 1. Infrastructure Overview

EduSystem is a **multi-tenant SaaS educational management platform** deployed as a **containerized monorepo** on a single host (VM, bare metal, or cloud instance). The infrastructure is orchestrated exclusively with **Docker Compose**, providing a self-contained, reproducible deployment model that covers the full stack from local development through production.

### Infrastructure at a Glance

```mermaid
graph LR
    subgraph Infrastructure
        direction TB
        HOST[Host / VM / Bare Metal]
        subgraph Docker Platform
            subgraph Data Layer
                PG[(PostgreSQL 16)]
                REDIS[(Redis 7)]
                MINIO[(MinIO S3)]
            end
            subgraph Compute Layer
                API[NestJS API]
                WORKER[NestJS Worker]
                WEB[Next.js Web]
                BULLBOARD[Bull Board]
            end
        end
    end

    HOST -->|Docker Compose| PG
    HOST -->|Docker Compose| REDIS
    HOST -->|Docker Compose| MINIO
    HOST -->|Docker Compose| API
    HOST -->|Docker Compose| WORKER
    HOST -->|Docker Compose| WEB
    HOST -->|Docker Compose| BULLBOARD
```

### Services Summary

| Service | Image | Role | Container Name |
|---|---|---|---|
| `postgres` | `postgres:16-alpine` | Primary relational database | `edusystem-db` |
| `redis` | `redis:7-alpine` | Job broker, cache, Socket.io adapter | `edusystem-redis` |
| `api` | Custom (NestJS multi-stage) | HTTP REST API server | `edusystem-api` |
| `worker` | Custom (same image as `api`) | Background job consumer | `edusystem-worker` |
| `web` | Custom (Next.js multi-stage) | SSR admin panel | `edusystem-web` |
| `minio` | `minio/minio:latest` | S3-compatible object storage | `edusystem-minio` |
| `bull-board` | `deadly0/bull-board:latest` | Queue monitoring UI (dev only) | `edusystem-bull-board` |

### Why This Stack?

| Component | Choice | Rationale |
|---|---|---|
| **Container Orchestration** | Docker Compose (single-host) | Simpler than Kubernetes for single-node deployments; production-ready for target scale (small-to-medium institutions). |
| **Database** | PostgreSQL 16 | ACID compliance, strong JSON/JSONB support, row-level security, mature Prisma driver. |
| **Cache/Queue Broker** | Redis 7 | Required for BullMQ; also enables future caching and Socket.io adapter. AOF persistence ensures no job loss. |
| **Object Storage** | MinIO (S3-compatible) | Self-hosted, no vendor lock-in, same API as AWS S3, runs in Docker. |
| **Backend Runtime** | NestJS 10 (dual-mode) | Same codebase runs as API or Worker via `APP_MODE` env var. No duplication. |
| **Frontend Runtime** | Next.js 16 (App Router) | SSR for performance, API routes for BFF pattern, image optimization. |

---

## 2. Deployment Topology

```mermaid
graph TB
    subgraph External
        CLIENTS[(Clients<br/>Browsers, Mobile)]
        FCM[(Firebase<br/>Cloud Messaging)]
        S3[(AWS S3<br/>Optional in prod)]
    end

    subgraph Docker Network: edusystem-network
        subgraph Web Layer
            WEB[Next.js<br/>Port 3000]
        end

        subgraph API Layer
            API[NestJS API<br/>Port 4000]
        end

        subgraph Worker Layer
            WORKER[NestJS Worker<br/>No HTTP]
        end

        subgraph Data Layer
            PG[(PostgreSQL<br/>Port 5432)]
            REDIS[(Redis<br/>Port 6379)]
            MINIO[(MinIO<br/>Ports 9000/9001)]
        end

        subgraph Dev Only
            BULLBOARD[Bull Board<br/>Port 3001]
        end
    end

    CLIENTS -->|HTTPS| WEB
    CLIENTS -->|REST /api/v1| API
    WEB -.->|SSR Pages| API
    API -->|BullMQ Producer| REDIS
    WORKER -->|BullMQ Consumer| REDIS
    API -->|Prisma ORM| PG
    WORKER -->|Prisma ORM| PG
    API -->|S3 Protocol| MINIO
    WORKER -->|S3 Protocol| MINIO
    WORKER -->|FCM Admin SDK| FCM
    WORKER -->|S3 Protocol| S3
    BULLBOARD -->|Queue Monitor| REDIS

    WEB -.->|Proxy| API
```

### Request Flow

1. **Client requests** hit the Next.js web server (port 3000).
2. **Next.js** serves SSR pages and proxies API calls to the NestJS API (port 4000).
3. **NestJS API** authenticates, validates, and persists to PostgreSQL.
4. **Side effects** (notifications, audit logs, PDF generation, grade recalculation) are enqueued to Redis via BullMQ.
5. **Worker** consumes jobs from Redis, executes asynchronously, and persists results to PostgreSQL.
6. **FCM push** and MinIO uploads are performed directly from the Worker.
7. **Bull Board** (dev only) monitors queue health via Redis.

### Port Mapping Summary

| Service | Internal Port | External Port | Protocol | Exposed To |
|---|---|---|---|---|
| `postgres` | 5432 | 5432 (env: `${POSTGRES_PORT}`) | TCP | API, Worker only |
| `redis` | 6379 | 6379 (env: `${REDIS_PORT}`) | TCP | API, Worker, Bull Board |
| `api` | 4000 | 4000 | HTTP | Web, External clients |
| `web` | 3000 | 3000 | HTTP | External clients |
| `minio` (API) | 9000 | 9000 | HTTP/S3 | API, Worker |
| `minio` (Console) | 9001 | 9001 | HTTP | Admins |
| `bull-board` | 3000 | 3001 | HTTP | Dev only (profile: dev) |

---

## 3. Container Architecture

### Multi-Stage Dockerfile Strategy

Both the API and Worker containers are built from the **same Dockerfile** using multi-stage builds and the `BUILD_TARGET` argument:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Development
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "start:dev"]

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
RUN npm ci --omit=dev
CMD ["npm", "run", "start:prod"]
```

- **Development target:** Mounts `src/` as read-only volume for hot reload. No build step needed.
- **Production target:** Pre-compiled TypeScript in `dist/`, pruned `node_modules`.

### Container Isolation

| Container | HTTP Surface | Database Access | Redis Access | MinIO Access |
|---|---|---|---|---|
| `api` | Yes (port 4000) | Read/Write | BullMQ Producer only | Read/Write |
| `worker` | No | Read/Write | BullMQ Consumer only | Read/Write |
| `web` | Yes (port 3000) | No direct | No | No |
| `postgres` | No | N/A | No | No |
| `redis` | No | No | N/A | No |
| `minio` | Yes (ports 9000, 9001) | No | No | N/A |

### Dual-Mode Bootstrap

The **same `main.ts`** entry point handles both modes via the `APP_MODE` environment variable:

```
APP_MODE=api    → NestFactory.create(AppModule) → HTTP server on port 4000
APP_MODE=worker → NestFactory.create(WorkerAppModule) → BullMQ consumers, no HTTP
```

This eliminates code duplication and ensures that API and Worker run the **same application logic** (same Prisma schema, same Zod validation, same business rules).

---

## 4. Docker Compose Strategy

### Compose File Structure

```
edusystem/
├── docker-compose.yml          # Base: all environments
├── docker-compose.override.yml # Local dev overrides (auto-loaded)
└── docker-compose.prod.yml     # Production overlay
```

### Profiles

| Profile | Services Started | Use Case |
|---|---|---|
| **default** | postgres, redis, api, worker, web, minio | Local development, staging |
| **dev** | + bull-board | Full development with queue monitoring |

### Startup Ordering

All services use `depends_on` with `condition: service_healthy` to guarantee correct startup order:

```
postgres (healthy) → redis (healthy) → minio (healthy) → api (healthy) → web (ready)
                                                         → worker (ready)
```

Health checks ensure data dependencies are available before the next service starts.

### Development vs Production Differences

| Aspect | Development | Production |
|---|---|---|
| `BUILD_TARGET` | `development` | `production` |
| `NODE_ENV` | `development` | `production` |
| Volumes mounted | `src/` as read-only | None (immutable image) |
| Swagger | Enabled at `/docs` | Disabled |
| Logs | Colorized, human-readable | Structured JSON |
| `redis` password | Empty | Required |
| `minio` TLS | Disabled | Required |
| `bull-board` | Started (profile: dev) | Removed |
| `restart` policy | `unless-stopped` | `always` |

### Production Overlay Pattern

```bash
# Start production deployment
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

The overlay pattern allows production-specific configurations (TLS, secrets, resource limits) without modifying the base compose file.

---

## 5. Service Responsibilities

### API Service (`edusystem-api`)

**Responsibilities:**
- HTTP REST API on `/api/v1`
- JWT authentication (issue, verify, refresh)
- Tenant context extraction from JWT
- DTO validation (class-validator/Zod)
- Business logic execution
- Prisma ORM queries
- BullMQ job enqueueing (producer only)
- Presigned URL generation for MinIO
- Swagger/OpenAPI documentation (dev only)

**Does NOT do:**
- Direct FCM pushes
- PDF generation (triggers job, worker executes)
- Audit log writes (triggers job, worker executes)
- Grade average recalculation (triggers job, worker executes)

### Worker Service (`edusystem-worker`)

**Responsibilities:**
- BullMQ job consumption (consumer only)
- FCM push notification delivery
- PDF report generation via Puppeteer
- Audit log persistence
- Student grade average recalculation
- In-app notification persistence

**Does NOT do:**
- HTTP serving
- CORS handling
- JWT verification (workers are internal)

### Web Service (`edusystem-web`)

**Responsibilities:**
- Next.js SSR/SSG for admin panel
- Static asset serving
- API proxy to NestJS API
- Image optimization
- Authentication via NextAuth v5
- Client-side React Query data fetching

### PostgreSQL Service (`edusystem-db`)

**Responsibilities:**
- Primary data store (30+ models)
- ACID transactions
- Unique constraints scoped by `institutionId`
- Soft-delete filtering via Prisma middleware
- Init script: partial unique index for SUPER_ADMIN (email WHERE institutionId IS NULL)

### Redis Service (`edusystem-redis`)

**Responsibilities:**
- BullMQ job broker (job queue, retry, dead-letter)
- AOF persistence (survive restarts without job loss)
- Bull Board data source

### MinIO Service (`edusystem-minio`)

**Responsibilities:**
- S3-compatible object storage
- User avatars: `avatars/{userId}.{ext}`
- Institution logos: `logos/{institutionId}.{ext}`
- PDF reports: `reports/{institutionId}/{date}/{filename}.pdf`
- Justification files: `justifications/{justificationId}/{filename}`

---

## 6. PostgreSQL Architecture

### Schema Design

The schema is managed via **Prisma ORM** with 30+ models and 15+ enums. Key design decisions:

- **Multi-tenancy column:** Every tenant-scoped table contains `institutionId` (UUID, foreign key to `Institution`).
- **Tenant-scoped uniqueness:** `@@unique([institutionId, code])` on `Subject`, `@@unique([institutionId, documentNumber])` on `Student`, `@@unique([email, institutionId])` on `User`.
- **SUPER_ADMIN exception:** `User.institutionId` is nullable. A partial unique index (`UNIQUE WHERE institutionId IS NULL`) allows `SUPER_ADMIN` users without an institution.
- **Soft delete:** Models with `deletedAt DateTime?` are filtered by Prisma middleware injecting `deletedAt: null` into all `findMany` and `findFirst` queries.
- **Audit trail:** `AuditLog` captures `before`/`after` JSON snapshots for every sensitive mutation.

### Initialization Script

On first startup, the `init.sql` script runs automatically:

```sql
-- Create partial unique index for SUPER_ADMIN (no institutionId)
CREATE UNIQUE INDEX "User_email_partial_unique"
ON "User"(email)
WHERE "institutionId" IS NULL;
```

This enables the same email to exist as `SUPER_ADMIN` without conflicting with institution-scoped user emails.

### Connection Pooling

| Setting | Development | Production |
|---|---|---|
| Prisma `connection_limit` | Default (10) | `connection_limit=20` via env |
| PgBouncer | Not used | Recommended |

### Backup Considerations

- **WAL archiving** for point-in-time recovery
- **pg_dump** cron for logical backups (daily)
- Backup destination: S3-compatible storage (MinIO or AWS S3)
- Recovery Point Objective (RPO): **24 hours** (configurable)
- Recovery Time Objective (RTO): **2 hours** (estimated for logical restore)

---

## 7. Redis Architecture

### Why Redis Is Required

Redis serves **three distinct purposes** in EduSystem:

1. **BullMQ Broker:** All asynchronous jobs (notifications, audit logs, PDF generation, grade recalculation) are enqueued in Redis. BullMQ requires a Redis connection to manage the queue, store job metadata, handle retries, and coordinate dead-letter queues.

2. **AOF Persistence:** The `redis.conf` enables AOF (Append-Only File) with `appendfsync everysec`. This means jobs are not lost if the container restarts. Without persistence, all pending jobs would be lost on restart.

3. **Future Socket.io Adapter:** The infrastructure reserves support for Socket.io with a Redis adapter for real-time chat and notifications. Currently not implemented.

### Redis Configuration

```yaml
redis:
  command: >
    redis-server
    --appendonly yes
    --appendfsync everysec
    --maxmemory 256mb
    --maxmemory-policy noeviction
```

| Setting | Value | Rationale |
|---|---|---|
| `appendonly yes` | AOF enabled | Survive restarts |
| `appendfsync everysec` | Moderate durability | Balance performance/safety |
| `maxmemory 256mb` | Memory cap | Prevent runaway memory usage |
| `maxmemory-policy noeviction` | Reject writes if full | Prevent data corruption |

### Memory Allocation

256MB is sufficient for:
- ~50,000 pending BullMQ jobs (each ~1-2KB metadata)
- ~10,000 Pub/Sub channels (future Socket.io)
- Current load: ~20-50MB typical usage

### Monitoring

| Metric | Alert Threshold | Action |
|---|---|---|
| `used_memory_human` | >200MB | Scale Redis or investigate leak |
| `connected_clients` | >100 | Investigate connection leak |
| `blocked_clients` | >0 | Investigate stuck jobs |
| `aof_rewrite_in_progress` | 1 | Normal during AOF rewrite |
| `keyspace_hits` / `keyspace_misses` | hit ratio <80% | Investigate cache efficiency |

---

## 8. BullMQ Infrastructure

### Queue Architecture

```mermaid
flowchart LR
    subgraph API
        SERVICE[Service Layer]
        PRODUCER[BullMQ Producer]
    end

    subgraph Redis
        Q1[(notifications)]
        Q2[(audit-log)]
        Q3[(grade-processing)]
        Q4[(pdf-generation)]
    end

    subgraph Worker
        P1[NotificationProcessor]
        P2[AuditProcessor]
        P3[GradeProcessor]
        P4[PdfProcessor]
    end

    SERVICE -->|Enqueue| PRODUCER
    PRODUCER -->|LPUSH| Q1
    PRODUCER -->|LPUSH| Q2
    PRODUCER -->|LPUSH| Q3
    PRODUCER -->|LPUSH| Q4
    Q1 -->|BRPOP| P1
    Q2 -->|BRPOP| P2
    Q3 -->|BRPOP| P3
    Q4 -->|BRPOP| P4
```

### Queues and Job Types

| Queue | Job Types | Processor | Priority | Attempts | Backoff |
|---|---|---|---|---|---|
| `notifications` | `grade.created`, `attendance.recorded`, `announcement.published`, `invitation.created`, `absence_record.generated` | `NotificationProcessor` | 0 (high) | 3 | Exponential 2s |
| `audit-log` | `audit.log` | `AuditProcessor` | 0 (high) | 5 | Exponential 1s |
| `grade-processing` | `grade.recalculate-average` | `GradeProcessor` | 0 (high) | 3 | Exponential 2s |
| `pdf-generation` | `pdf.generate-report` | Inline in `ReportsService` | 10 (low) | 2 | Fixed 5s |

### Job Flow

1. **API receives request** (e.g., grade created)
2. **Service executes business logic** and persists to PostgreSQL
3. **Service calls** `NotificationQueueService.notify()` with job data
4. **BullMQ Producer** enqueues job to Redis with retry options
5. **Worker** (separate container) dequeues job via BRPOP
6. **Processor executes** the job (e.g., send FCM push, persist notification)
7. **On failure:** BullMQ retries with exponential backoff up to `attempts` times
8. **On exhausted retries:** Job moves to failed queue, logged for investigation

### Why BullMQ Workers Are Isolated

The worker is a **separate container** (not a thread or process within the API) for three critical reasons:

1. **Horizontal Scaling:** Workers can be scaled independently from the API. During report-heavy periods (end of trimester), add more worker replicas. During API-heavy periods (grading season), add more API replicas.

2. **Resource Isolation:** Puppeteer (PDF generation) is CPU and memory intensive. Running it in a separate container prevents it from starving HTTP request processing. A crashing worker does not affect API availability.

3. **Security Surface Reduction:** The worker has **no HTTP surface**, no CORS configuration, no JWT guards, and no TenantMiddleware. If compromised, the attack surface is limited to Redis/PostgreSQL communication.

4. **Failure Isolation:** If a BullMQ processor throws an unhandled exception, only that worker process crashes. The API server continues serving HTTP requests.

---

## 9. Worker Isolation Strategy

### WorkerAppModule Design

The `WorkerAppModule` is a **minimal NestJS module** that intentionally does NOT import:

- `ControllersModule` (no HTTP routes)
- `TenantMiddleware` (Express middleware)
- `JwtAuthGuard` (HTTP authentication)
- `OnLeaveGuard` (HTTP state guard)
- `GlobalExceptionFilter` with HTTP context
- `SwaggerModule`

```typescript
// WorkerAppModule — minimal imports only
import { AppConfigModule } from './config/config.module';   // Env validation
import { PrismaModule } from './prisma/prisma.module';       // DB access
import { QueuesModule } from './queues/queues.module';       // BullMQ setup
import { WorkersModule } from './queues/workers.module';       // Processors
import { NotificationsModule } from './modules/notifications/notifications.module'; // FCM
```

### Memory Footprint

| Module | API Mode | Worker Mode |
|---|---|---|
| Controllers | ~15MB | 0MB |
| Guards/Middleware | ~8MB | 0MB |
| Swagger | ~10MB | 0MB |
| Workers/Processors | 0MB | ~25MB |
| **Total** | ~120MB | ~80MB |

Worker mode has a **~33% smaller memory footprint** due to the absence of HTTP infrastructure.

### Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  logger.log('Worker stopping...');
  await app.close(); // Closes NestJS + Prisma connection
});
```

On `SIGTERM` (Docker stop), the worker:
1. Stops accepting new jobs (drains current job if in progress)
2. Closes the NestJS application gracefully
3. Closes the Prisma connection

Jobs in-progress are retried by BullMQ (up to `attempts` times).

---

## 10. MinIO Storage Architecture

### Why MinIO Was Selected

| Criteria | MinIO | AWS S3 | Dropbox/GDrive |
|---|---|---|---|
| Self-hosted | Yes | No | No |
| S3-compatible API | Yes | Yes | No |
| Runs in Docker | Yes | N/A | No |
| No egress costs | Yes | No | No |
| Single-node capable | Yes | Yes | Yes |
| Production-ready | Yes | Yes | No (for this use case) |

MinIO provides **all the benefits of S3 without vendor lock-in or egress costs**, while running in the same Docker environment as the rest of the stack.

### Storage Buckets and Path Patterns

| Asset Type | Path Pattern | Access | Expiry |
|---|---|---|---|
| User Avatars | `avatars/{userId}.{ext}` | Presigned GET (15min) | Never |
| Institution Logos | `logos/{institutionId}.{ext}` | Presigned GET (5min, cached) | Never |
| PDF Reports | `reports/{institutionId}/{year}/{month}/{filename}.pdf` | Presigned GET (30min) | 30 days |
| Justification Files | `justifications/{justificationId}/{filename}` | Presigned GET (1hr) | Never |

### Upload Flow (Presigned URL Pattern)

```
1. Frontend → API:    POST /storage/presign { fileName, mimeType, folder }
2. API → MinIO:        Create presigned PUT URL (expires: 15min)
3. API → Frontend:     Return presigned URL
4. Frontend → MinIO:   PUT file directly (bypasses API server)
5. Frontend → API:    POST /storage/confirm { key, url }
6. API → DB:           Store object key in appropriate table
```

This pattern avoids uploading large files through the API server, reducing bandwidth and processing overhead.

### Production Alternative: AWS S3

```yaml
# Override in docker-compose.prod.yml
environment:
  AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
  AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
  AWS_REGION: ${AWS_REGION}
  AWS_S3_BUCKET: ${AWS_S3_BUCKET}
```

The compose file supports swapping MinIO for AWS S3 by overriding environment variables. The API uses the AWS SDK for S3-compatible storage, which works with both MinIO and AWS S3.

---

## 11. Networking Topology

### Network Architecture

```mermaid
graph TB
    subgraph External Network
        USER[(End Users)]
        ADMIN[(Institution Admins)]
    end

    subgraph edusystem-network (bridge driver)
        WEB[Web :3000]
        API[API :4000]
        WORKER[Worker (no ports)]
        PG[PostgreSQL :5432]
        REDIS[Redis :6379]
        MINIO_API[MinIO API :9000]
        MINIO_CONSOLE[MinIO Console :9001]
        BULLBOARD[Bull Board :3001 dev]
    end

    USER -->|HTTPS :3000| WEB
    ADMIN -->|HTTPS :3000| WEB
    WEB -->|HTTP :4000| API
    API -->|TCP :5432| PG
    API -->|TCP :6379| REDIS
    API -->|TCP :9000| MINIO_API
    WORKER -->|TCP :5432| PG
    WORKER -->|TCP :6379| REDIS
    WORKER -->|TCP :9000| MINIO_API
    BULLBOARD -->|TCP :6379| REDIS
```

### Port Exposure Strategy

| Port | Exposed to Host | Rationale |
|---|---|---|
| 3000 (web) | Yes | End users access the application |
| 4000 (api) | Yes (dev) / Reverse proxy (prod) | API endpoints; production should use reverse proxy |
| 5432 (postgres) | Yes (dev) / No (prod) | Local development access; production via internal Docker network |
| 6379 (redis) | Yes (dev) / No (prod) | Dev tools; production via internal Docker network |
| 9000 (minio) | No | S3 API accessed via API server (presigned URLs) |
| 9001 (minio) | Yes (dev) / No (prod) | Dev access; production via VPN or bastion |
| 3001 (bull-board) | Yes (dev profile only) | Queue monitoring; never exposed in production |

### Reverse Proxy (Production)

For production, place a **reverse proxy** (nginx, Traefik, or cloud load balancer) in front of the services:

```
End Users → [HTTPS:443 nginx] → :3000 web
                              → :4000 api (if direct API access needed)
```

Nginx configuration should:
- Terminate TLS
- Set `X-Forwarded-*` headers for `ALLOWED_ORIGINS` validation
- Serve static assets with aggressive caching
- WebSocket upgrade headers for future Socket.io
- Rate limiting on auth endpoints

---

## 12. Volume Persistence Strategy

### Named Volumes

| Volume | Driver | Contents | Backup Strategy |
|---|---|---|---|
| `postgres_data` | local | PostgreSQL data files (`/var/lib/postgresql/data`) | pg_dump to S3, WAL archiving |
| `redis_data` | local | Redis AOF + RDB (`/data`) | Not backed up (replayable from queue) |
| `minio_data` | local | All uploaded objects (`/data`) | Sync to AWS S3 for production |

### Volume Lifecycle

```yaml
volumes:
  postgres_data:
    driver: local   # Persists across container restarts
  redis_data:
    driver: local
  minio_data:
    driver: local

networks:
  default:
    name: edusystem-network
    driver: bridge  # Bridge: containers can communicate; no external access
```

### Data Persistence Guarantees

| Service | Write-Ahead Log | Volume Backup | RPO |
|---|---|---|---|
| PostgreSQL | WAL enabled | pg_dump + WAL archiving | 24 hours (configurable) |
| Redis | AOF everysec | Not needed (jobs replay from queue) | N/A |
| MinIO | N/A | `mc mirror` to S3 | 24 hours |

### Development Volume Mounts

```yaml
api:
  volumes:
    - ./backend/src:/app/src:ro   # Hot reload

worker:
  volumes:
    - ./backend/src:/app/src:ro   # Hot reload

web:
  volumes:
    - ./frontend/src:/app/src:ro   # Hot reload
```

In development, `src/` directories are mounted as **read-only** (`ro`) to prevent accidental writes from inside the container to the host source tree.

---

## 13. Environment Configuration

### Environment Variable Categories

| Category | Variables | Required In |
|---|---|---|
| **App** | `NODE_ENV`, `APP_MODE`, `PORT` | API, Worker |
| **Database** | `DATABASE_URL` | API, Worker |
| **Redis** | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | API, Worker, Bull Board |
| **JWT** | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | API |
| **CORS** | `ALLOWED_ORIGINS` | API |
| **Storage** | `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL` | API, Worker |
| **Storage (AWS)** | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` | API, Worker |
| **Push** | `FCM_PROJECT_ID`, `FCM_PRIVATE_KEY`, `FCM_CLIENT_EMAIL` | Worker |
| **Queues** | `BULL_QUEUE_NOTIFICATIONS`, `BULL_QUEUE_PDF`, `BULL_QUEUE_AUDIT`, `BULL_QUEUE_GRADES` | API, Worker |
| **Frontend** | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL` | Web |

### Secrets Management

| Approach | Development | Production |
|---|---|---|
| **Storage** | `.env` file (never committed) | HashiCorp Vault, AWS Secrets Manager, Kubernetes Secrets |
| **JWT_SECRET** | `change-this-in-production` | `openssl rand -base64 64` |
| **PostgreSQL** | Default password | Strong random password via secrets manager |
| **Redis** | Empty password | Strong random password |
| **MinIO** | Default access key | Unique credentials per deployment |

### Production .env Template

```bash
# .env.production
NODE_ENV=production
BUILD_TARGET=production
APP_MODE=api

# Database
DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/edusystem
POSTGRES_PASSWORD=<vault:postgres_password>
POSTGRES_DB=edusystem

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<vault:redis_password>

# JWT (generate with: openssl rand -base64 64)
JWT_SECRET=<vault:jwt_secret>
JWT_REFRESH_SECRET=<vault:jwt_refresh_secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=https://edusystem.example.com,https://admin.edusystem.example.com

# Storage (AWS S3 in production)
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_PORT=443
MINIO_USE_SSL=true
AWS_ACCESS_KEY_ID=<vault:aws_access_key>
AWS_SECRET_ACCESS_KEY=<vault:aws_secret_key>
AWS_REGION=us-east-1
AWS_S3_BUCKET=edusystem-prod

# Frontend
NEXTAUTH_URL=https://edusystem.example.com
NEXTAUTH_SECRET=<vault:nextauth_secret>
NEXT_PUBLIC_API_URL=https://api.edusystem.example.com/api/v1
NEXT_PUBLIC_WS_URL=https://api.edusystem.example.com

# Push Notifications
FCM_PROJECT_ID=<vault:fcm_project_id>
FCM_PRIVATE_KEY=<vault:fcm_private_key>
FCM_CLIENT_EMAIL=<vault:fcm_client_email>
```

---

## 14. Environment Validation

### Zod Schema Validation

All environment variables are validated at **application startup** using Zod. If any required variable is missing or invalid, the application **exits immediately** with a clear error message — it does not start in an invalid state.

```typescript
// src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_MODE: z.enum(['api', 'worker']).default('api'),
  PORT: z.string().default('4000').transform(Number),

  DATABASE_URL: z.string().url({
    message: 'DATABASE_URL must be a valid PostgreSQL URL'
  }),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().min(32, {
    message: 'JWT_SECRET must be at least 32 characters'
  }),
  JWT_REFRESH_SECRET: z.string().min(32, {
    message: 'JWT_REFRESH_SECRET must be at least 32 characters'
  }),

  // ... additional fields
});

export type EnvConfig = z.infer<typeof envSchema>;
```

### Validation in Bootstrap

```typescript
// src/main.ts
const config = envSchema.parse(process.env); // Throws and exits if invalid
```

### Validation Rules Summary

| Variable | Rule | Error if |
|---|---|---|
| `DATABASE_URL` | Valid URL format | Invalid connection string |
| `JWT_SECRET` | Minimum 32 characters | Weak secret |
| `JWT_REFRESH_SECRET` | Minimum 32 characters | Weak secret |
| `MINIO_SECRET_KEY` | Minimum 1 character | Not provided |
| `FCM_CLIENT_EMAIL` | Valid email format (if provided) | Invalid FCM configuration |
| `APP_MODE` | `api` or `worker` only | Invalid runtime mode |

### Secret Rotation Strategy

1. **JWT secrets:** Rotate by setting `JWT_SECRET` and `JWT_REFRESH_SECRET`, then restart API. In-flight tokens signed with old secrets will be rejected (logout required).
2. **Database password:** Rotate via PostgreSQL, update `POSTGRES_PASSWORD` in env, restart all services.
3. **MinIO credentials:** Rotate in MinIO console, update env, restart API and Worker.

---

## 15. Development Environment

### Local Startup

```bash
# Full stack with queue monitoring
docker-compose --profile dev up -d

# API only for IDE debugging
docker-compose up -d postgres redis minio api

# Frontend hot reload (host-side)
cd frontend && npm run dev
```

### Hot Reload Configuration

| Service | Volume Mount | Reload Trigger |
|---|---|---|
| `api` | `./backend/src:/app/src:ro` | TypeScript file change detected by `ts-node-dev` |
| `worker` | `./backend/src:/app/src:ro` | Same as API |
| `web` | `./frontend/src:/app/src:ro` | Next.js HMR via webpack |

### Local Dependency Tree

```mermaid
flowchart TD
    DOCKER[Docker Compose]
    DOCKER --> PG[PostgreSQL :5432]
    DOCKER --> REDIS[Redis :6379]
    DOCKER --> MINIO[MinIO :9000/:9001]
    DOCKER --> API[NestJS :4000]
    DOCKER --> WORKER[NestJS Worker]
    DOCKER --> WEB[Next.js :3000]
    DOCKER --> BB[Bull Board :3001]

    API -->|Prisma| PG
    API -->|BullMQ| REDIS
    API -->|S3| MINIO
    WORKER -->|Prisma| PG
    WORKER -->|BullMQ| REDIS
    WORKER -->|S3| MINIO
    WORKER -->|FCM| FCM[Firebase]
    WEB -->|Proxy| API
    BB -->|Monitor| REDIS

    style DOCKER fill:#e1f5fe
    style PG fill:#f3e5f5
    style REDIS fill:#fff3e0
    style API fill:#e8f5e9
    style WORKER fill:#e8f5e9
```

### Database Migration Workflow

```bash
# Run migrations (development)
docker exec -it edusystem-api npx prisma migrate dev

# Seed database
docker exec -it edusystem-api npx prisma db seed

# Run migrations (production — non-interactive)
docker exec -it edusystem-api npx prisma migrate deploy
```

### IDE Debugging

For IDE debugging (VSCode), attach to the `api` container:

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "attach",
  "name": "Debug API Container",
  "port": 9229,
  "restart": true,
  "sourceMaps": true,
  "remoteRoot": "/app"
}
```

Configure `api` service to expose debugging port:

```yaml
api:
  ports:
    - '4000:4000'
    - '9229:9229'  # Debug port
  command: node --inspect=0.0.0.0:9229 ./node_modules/.bin/ts-node-dev --respawn src/main.ts
```

---

## 16. Production Environment

### Production Hardening Checklist

| Category | Requirement | Implementation |
|---|---|---|
| **Secrets** | No default credentials | Generate strong random secrets via `openssl rand -base64 64` |
| **Secrets** | No `.env` in repo | Use secrets manager (Vault, AWS Secrets Manager) |
| **TLS** | HTTPS everywhere | nginx/Caddy in front; MinIO TLS enabled |
| **CORS** | Exact origins only | `ALLOWED_ORIGINS` set to exact production domains |
| **Redis** | Password required | `REDIS_PASSWORD` must be non-empty |
| **Logs** | Structured JSON | NestJS `Logger` replaced with `pino` |
| **Logs** | No stack traces in 500s | `GlobalExceptionFilter` strips stack in production |
| **Restart** | `always` policy | Containers restart automatically on failure |
| **Health checks** | All services | `healthcheck` in compose ensures startup ordering |
| **Swagger** | Disabled | `isDev` check naturally disables in production |
| **MinIO** | TLS enabled | `MINIO_USE_SSL=true` |
| **Rate limiting** | Auth endpoints | `@nestjs/throttler` on login/logout |
| **PgBouncer** | Connection pooling | Add between API and PostgreSQL |

### Production Deployment Architecture

```mermaid
graph TB
    subgraph Cloud / Hosting Provider
        subgraph Virtual Machine / Bare Metal
            subgraph Docker Platform
                subgraph Containers
                    PG[(PostgreSQL<br/>16)]
                    REDIS[(Redis<br/>7)]
                    API[NestJS API]
                    WORKER[NestJS Worker]
                    WEB[Next.js Web]
                end
                subgraph Docker Networks
                    EDUNET[edusystem-network<br/>bridge]
                end
                subgraph Docker Volumes
                    PVOL[postgres_data]
                    RVOL[redis_data]
                    MVOL[minio_data]
                end
            end
        end
        subgraph External Services
            LB[Load Balancer<br/>HTTPS terminator]
            S3B[AWS S3<br/>Production storage]
            FCM[Firebase<br/>Push notifications]
        end
    end

    USERS[(End Users)] -->|HTTPS| LB
    LB -->|Proxy| WEB
    WEB -->|HTTP| API
    API -->|Prisma| PG
    API -->|BullMQ| REDIS
    API -->|S3 SDK| S3B
    WORKER -->|Prisma| PG
    WORKER -->|BullMQ| REDIS
    WORKER -->|S3 SDK| S3B
    WORKER -->|FCM Admin| FCM

    EDUNET -.-> PVOL
    EDUNET -.-> RVOL
    EDUNET -.-> MVOL
```

### Production Environment Variables (docker-compose.prod.yml)

```yaml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    command: >
      redis-server
      --requirepass ${REDIS_PASSWORD}
      --appendonly yes
      --appendfsync everysec
      --maxmemory 256mb
      --maxmemory-policy noeviction

  api:
    build:
      target: production
    environment:
      NODE_ENV: production
      BUILD_TARGET: production
    restart: always
    volumes: []  # No src mount in production

  worker:
    build:
      target: production
    environment:
      NODE_ENV: production
      BUILD_TARGET: production
    restart: always
    volumes: []

  web:
    build:
      target: production
    restart: always
    volumes: []
```

---

## 17. Scaling Strategy

### Vertical Scaling (Single Host)

| Component | Baseline | Peak | Recommendation |
|---|---|---|---|
| CPU | 2 cores | 4+ cores | NestJS is CPU-light; Puppeteer (Worker) is CPU-heavy |
| RAM | 4GB | 8-16GB | PostgreSQL (~512MB), Redis (~256MB), API (~200MB), Worker (~300MB), Web (~512MB) |
| Disk | 50GB | 200GB+ | MinIO data grows with user uploads |

### Horizontal Scaling (Multi-Host)

```mermaid
graph TB
    subgraph Load Balancer
        LB[nginx / Traefik<br/>:443 HTTPS]
    end

    subgraph Host 1
        subgraph Docker1
            API1[NestJS API]
            WORKER1[NestJS Worker]
        end
    end

    subgraph Host 2
        subgraph Docker2
            API2[NestJS API]
            WORKER2[NestJS Worker]
        end
    end

    subgraph Shared Infrastructure
        PG[(PostgreSQL<br/>Primary)]
        PG_REPLICA[(PostgreSQL<br/>Read Replica)]
        REDIS[(Redis<br/>Cluster / Sentinel)]
        MINIO[(MinIO<br/>Distributed)]
    end

    LB --> API1
    LB --> API2
    API1 --> PG
    API2 --> PG
    API1 --> PG_REPLICA
    API2 --> PG_REPLICA
    API1 --> REDIS
    API2 --> REDIS

    style LB fill:#e1f5fe
    style PG fill:#f3e5f5
    style REDIS fill:#fff3e0
```

### Scaling Checklist by Scenario

| Scenario | Scale Action | Priority |
|---|---|---|
| High API latency | Scale API replicas | High |
| Slow PDF generation | Scale Worker replicas | High |
| PostgreSQL connection exhaustion | Add PgBouncer; consider read replica | Medium |
| Redis memory pressure | Add memory; tune AOF | Medium |
| High disk usage (MinIO) | Migrate to AWS S3 | Medium |
| Web serving slow | Scale Web replicas; enable CDN | Medium |

---

## 18. Horizontal Scaling Considerations

### Stateless Services

All compute services are **stateless** and support horizontal scaling:

| Service | Stateless | Scale Mechanism |
|---|---|---|
| `api` | Yes | Add container replicas; load balancer distributes |
| `worker` | Yes | Add container replicas; BullMQ distributes jobs |
| `web` | Yes | Add container replicas; load balancer distributes |

### BullMQ Worker Distribution

When multiple worker containers are running, BullMQ automatically distributes jobs:

```mermaid
sequenceDiagram
    participant API
    participant Redis as Redis
    participant Worker1
    participant Worker2

    API->>Redis: LPUSH job to 'notifications'
    Redis->>Worker1: BRPOP (competes for job)
    Redis->>Worker2: BRPOP (competes for job)
    Worker1-->>Redis: Job acquired
    Worker2->>Redis: No job available (blocked)
    Worker1->>Worker1: Process notification
    Worker1->>Redis: ACK job
```

Multiple workers provide:
- **Higher throughput:** More jobs processed in parallel
- **Fault tolerance:** If one worker crashes, jobs are requeued and picked up by another
- **Priority handling:** High-priority queues are served first across all workers

### Database Connection Pooling

With `N` API replicas, each maintains its own Prisma connection pool. At `N=10` with default pool size of 10, up to 100 connections to PostgreSQL can be used.

```yaml
# docker-compose.prod.yml
api:
  deploy:
    replicas: 3
  environment:
    DATABASE_URL: postgresql://.../?connection_limit=5&pool_timeout=10

postgres:
  command: >
    postgres
    -c max_connections=200
    -c shared_buffers=256MB
```

### Bottlenecks and Mitigations

| Bottleneck | Impact | Mitigation |
|---|---|---|
| **PDF generation (Puppeteer)** | CPU/memory intensive | Worker isolated; serial processing with shared browser; scale workers |
| **FCM push notifications** | External API rate limits | BullMQ retries; non-blocking API path |
| **Prisma connection pool** | Default 10 may exhaust | PgBouncer; `connection_limit` tuning |
| **Large bulk grade imports** | Long transactions | Prisma transactions with batching; background job |
| **MinIO disk I/O** | Slow uploads/downloads | SSD; network-attached storage; CDN for static assets |

---

## 19. High Availability Considerations

### Current HA Posture

| Component | HA Level | Notes |
|---|---|---|
| API | Basic | Restart policy `unless-stopped`; stateless (no local state) |
| Worker | Basic | Same as API; jobs survive via Redis AOF |
| Web | Basic | Next.js ISR provides some resilience |
| PostgreSQL | **Single point of failure** | No replication in current compose |
| Redis | **Single point of failure** | AOF persistence prevents job loss but no HA |
| MinIO | **Single point of failure** | No distributed mode |

### HA Roadmap by Priority

| Priority | Component | Recommendation | Effort |
|---|---|---|---|
| **1** | PostgreSQL | Streaming replication to read replica; automatic failover | Medium |
| **2** | Redis | Redis Sentinel or Redis Cluster (3 nodes) | Medium-High |
| **3** | API | Load balancer with health checks; multiple replicas | Low |
| **4** | MinIO | MinIO in distributed mode (4+ nodes) or migrate to AWS S3 | Low |

### Failover Strategy (PostgreSQL)

1. Primary PostgreSQL fails
2. **PgBouncer** detects connection failure via health check
3. **pg-pool** / **Patroni** promotes read replica to primary
4. DNS updated to point to new primary
5. Application reconnects via `DATABASE_URL` change or connection string update
6. Estimated RTO: **5-15 minutes**

### Load Balancer Health Checks

```nginx
upstream edusystem_api {
    server api_1:4000;
    server api_2:4000;
    server api_3:4000;
}

server {
    location /api/v1/health {
        proxy_pass http://edusystem_api;
        health_check interval=10s passes=2 fails=3;
    }
}
```

---

## 20. Disaster Recovery Considerations

### Recovery Time Objectives

| Data Type | RPO (Recovery Point Objective) | RTO (Recovery Time Objective) |
|---|---|---|
| User data (PostgreSQL) | 24 hours | 2 hours |
| Uploaded files (MinIO) | 24 hours | 4 hours |
| Queued jobs (Redis) | 0 minutes (AOF) | 30 minutes (queue reprocessing) |
| Configuration (env vars) | Changes tracked in git | 15 minutes |

### Disaster Scenarios and Recovery Plans

| Scenario | Impact | Recovery Steps | Estimated Time |
|---|---|---|---|
| **Host crash** | All services down | Restore from backup; restart Docker Compose | 30-60 minutes |
| **PostgreSQL data loss** | User data lost | Restore from pg_dump; replay WAL if available | 1-2 hours |
| **MinIO data loss** | User files lost | Restore from S3 backup; recreate missing object keys | 2-4 hours |
| **Redis failure** | Job loss (no AOF) | Worker replays from application state; manual notification trigger | 30 minutes |
| **Volume corruption** | All data lost | Restore from latest backup; re-run migrations | 2-4 hours |

### Recovery Runbook

```bash
# 1. Assess damage and identify last known good backup
docker-compose down
pg_restore --version  # check backup date

# 2. Restore PostgreSQL
docker-compose up -d postgres
docker exec -it edusystem-db pg_restore -U postgres -d edusystem /backups/latest.dump

# 3. Restore MinIO (if using AWS S3 sync)
mc mirror s3/edusystem-backup/ http://minio/edusystem/

# 4. Restart all services
docker-compose up -d

# 5. Verify
curl http://localhost:4000/api/v1/health
curl http://localhost:3000/api/v1/health
```

---

## 21. Backup Strategy

### Backup Architecture

```mermaid
flowchart LR
    subgraph Source
        PG[(PostgreSQL)]
        MINIO[(MinIO)]
        REDIS[(Redis)]
    end

    subgraph Backup Storage
        PG_BACKUP[S3 Compatible<br/>pg_dump + WAL]
        MINIO_BACKUP[S3 Compatible<br/>mc mirror]
        REDIS_BACKUP[Not backed up<br/>AOF only]
    end

    PG -.->|pg_dump daily<br/>WAL continuous| PG_BACKUP
    MINIO -.->|mc mirror hourly| MINIO_BACKUP
    REDIS -.->|AOF persistence| REDIS_BACKUP
```

### PostgreSQL Backup

```bash
# Daily pg_dump (via cron)
0 2 * * * docker exec edusystem-db pg_dump -U postgres -d edusystem \
  -Fc -f /backups/daily_$(date +\%Y\%m\%d).dump

# Copy to S3
0 3 * * * mc cp edusystem/pg_backups/daily_$(date +\%Y\%m\%d).dump s3/edusystem-backups/
```

### MinIO Backup (to AWS S3)

```bash
# Hourly sync to S3
0 * * * * mc mirror edusystem/edusystem s3/edusystem-backups/minio/ \
  --overwrite --remove

# Retention: 30 days on S3 (S3 lifecycle policy)
aws s3api put-bucket-lifecycle-configuration \
  --bucket edusystem-backups \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "minio-backup-retention",
      "Status": "Enabled",
      "Prefix": "minio/",
      "Expiration": {"Days": 30}
    }]
  }'
```

### Restore Test Schedule

| Frequency | Action |
|---|---|
| Monthly | Test restore PostgreSQL to isolated environment |
| Monthly | Verify MinIO backup integrity with `mc stat` |
| Quarterly | Full DR drill (complete infrastructure restore) |

---

## 22. Monitoring & Observability

### Monitoring Stack (Recommended)

| Layer | Tool | Purpose | URL |
|---|---|---|---|
| **Metrics** | Prometheus + Grafana | Time-series metrics, dashboards | Port 9090 |
| **Logs** | Loki + Grafana | Centralized log aggregation | Port 3100 |
| **Traces** | Tempo + Grafana | Distributed tracing (OpenTelemetry) | Port 4318 |
| **Alerting** | Alertmanager + PagerDuty | Alert routing and escalation | Configured |
| **Uptime** | Uptime Kuma | External health checks | Port 3001 (dedicated) |

### Key Metrics to Monitor

| Metric | Source | Alert Threshold |
|---|---|---|
| API response time (p50, p95, p99) | Prometheus | p99 > 2s |
| API error rate | Prometheus | >1% |
| Worker job queue depth | BullMQ Redis | >1000 jobs |
| Worker failed jobs | BullMQ Redis | >10 jobs in 5min |
| PostgreSQL connections | Prometheus | >80% of max |
| PostgreSQL slow queries | Prometheus | >100ms avg |
| Redis memory usage | Prometheus | >80% of 256MB |
| API CPU usage | Prometheus | >80% |
| API memory usage | Prometheus | >90% of limit |
| Worker CPU usage | Prometheus | >80% |
| MinIO disk usage | Prometheus | >80% |

### Health Check Endpoints

| Endpoint | Service | Returns | Use Case |
|---|---|---|---|
| `GET /api/v1/health` | API | `{ status: "ok", uptime: number }` | Load balancer health check |
| `GET /api/v1/health/ready` | API | `{ status: "ok", db: boolean, redis: boolean }` | Readiness probe |
| `pg_isready` | PostgreSQL | exit code 0 if ready | Docker healthcheck |
| `redis-cli ping` | Redis | `PONG` | Docker healthcheck |
| `curl http://localhost:9000/minio/health/live` | MinIO | `{"status":"ok"}` | Docker healthcheck |

### Prometheus Metrics (API)

Key metrics exposed at `GET /metrics`:

- `http_requests_total{method, route, status_code}`
- `http_request_duration_seconds{method, route}`
- `prisma_queries_total{type, model}`
- `prisma_query_duration_seconds`
- `bullmq_jobs_total{queue, status}`
- `bullmq_job_duration_seconds{queue}`
- `redis_memory_used_bytes`

### Grafana Dashboard Recommendations

1. **API Overview:** Request rate, error rate, response time, CPU/memory
2. **Worker Overview:** Queue depth, job throughput, failed jobs by queue
3. **Database Overview:** Connection count, slow queries, replication lag
4. **Infrastructure Overview:** All services, health status, volume usage

---

## 23. Logging Strategy

### Current State

The application uses NestJS's built-in `Logger`:
- Human-readable, colorized output in development
- Stack traces included in development
- Generic messages in production (no structured logging)

### Recommended: Structured Logging with Pino

```typescript
// src/main.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({
      service: 'edusystem-api',
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV,
    }),
  },
});
```

### Log Format (Production)

```json
{
  "level": "info",
  "time": "2026-05-14T10:30:00.000Z",
  "service": "edusystem-api",
  "version": "2.1.0",
  "environment": "production",
  "msg": "Request processed",
  "method": "POST",
  "path": "/api/v1/grades",
  "statusCode": 201,
  "duration_ms": 45,
  "institutionId": "uuid",
  "userId": "uuid",
  "requestId": "uuid"
}
```

### Log Aggregation Architecture

```mermaid
flowchart TB
    subgraph Containers
        API[API] -->|JSON logs| LOKI[Loki]
        WORKER[Worker] -->|JSON logs| LOKI
        WEB[Web] -->|JSON logs| LOKI
        PG[PostgreSQL] -->|audit logs| LOKI
    end

    subgraph Storage
        LOKI -->|Store| LOKI_DATA[(Loki Data)]
        LOKI -->|Alerts| ALERTMANAGER[Alertmanager]
    end

    subgraph Visualization
        LOKI_DATA --> GRAFANA[Grafana<br/>Dashboards<br/>Log search]
        ALERTMANAGER --> PAGERDUTY[PagerDuty]
    end
```

### Log Retention Policy

| Log Type | Retention | Storage |
|---|---|---|
| Application logs | 30 days | Loki (S3 backend) |
| Audit logs | 1 year | PostgreSQL `AuditLog` table |
| Worker job logs | 7 days | Loki (dead letter queue logs) |
| Infrastructure logs | 90 days | Loki |

---

## 24. CI/CD Recommendations

### CI/CD Pipeline Stages

```mermaid
flowchart LR
    subgraph CI
        LINT[Lint & Format<br/>ESLint, Prettier]
        TYPE[Tipocheck<br/>tsc --noEmit]
        TEST[Unit Tests<br/>Jest]
        BUILD[Build<br/>docker build]
    end

    subgraph CD
        SCAN[Security Scan<br/>Trivy, Snyk]
        PUSH[Push to Registry<br/>Docker Hub / ECR]
        DEPLOY[Deploy<br/>docker-compose up]
        MIGRATE[Run Migrations<br/>prisma migrate deploy]
    end

    subgraph Notify
        NOTIFY[Notify<br/>Slack / Teams]
        VERIFY[Verify Health<br/>curl /api/v1/health]
    end

    LINT --> TYPE --> TEST --> BUILD --> SCAN --> PUSH --> DEPLOY --> MIGRATE --> NOTIFY --> VERIFY
```

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Docker metadata
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}

      - name: Build images
        run: |
          docker build -f backend/Dockerfile -t edusystem-api:${{ github.sha }} ./backend
          docker build -f frontend/Dockerfile -t edusystem-web:${{ github.sha }} ./frontend

      - name: Run tests
        run: |
          docker compose run --rm api npm run test

      - name: Security scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

      - name: Push images
        run: |
          docker push edusystem-api:${{ github.sha }}
          docker push edusystem-web:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ubuntu
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/edusystem
            git pull
            docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
            docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
            docker exec edusystem-api npx prisma migrate deploy
            sleep 10
            curl -f http://localhost:4000/api/v1/health
```

### Docker Image Optimization

```dockerfile
# Multi-stage build (already implemented)
# Use specific alpine version for reproducibility
FROM node:20-alpine:3.19

# Layer caching for dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Separate layer for prisma
COPY prisma ./prisma
RUN npx prisma generate

# Build only needed for production target
```

### Database Migration in CI/CD

```yaml
# In deploy pipeline
- name: Run migrations
  run: |
    docker exec edusystem-api npx prisma migrate deploy
  timeout: 60s

- name: Seed (development only)
  condition: env.NODE_ENV == development
  run: |
    docker exec edusystem-api npx prisma db seed
```

**Critical rule:** Always use `prisma migrate deploy` in CI/CD (non-interactive). Never use `migrate dev`.

---

## 25. Security Considerations

### Defense in Depth Layers

| Layer | Control | Implementation |
|---|---|---|
| **Network** | TLS everywhere | nginx HTTPS; MinIO TLS |
| **Network** | Firewall / security groups | Restrict exposed ports to necessary only |
| **API** | JWT authentication | 15-minute expiry; refresh token rotation |
| **API** | RBAC + ABAC | CASL ability factory; role hierarchy |
| **API** | State-based | OnLeaveGuard blocks mutations for ON_LEAVE users |
| **API** | Rate limiting | @nestjs/throttler on auth endpoints |
| **Input** | DTO validation | Zod at config; class-validator at controller |
| **Database** | Parameterized queries | Prisma ORM (no raw SQL in business logic) |
| **Storage** | Presigned URLs | MinIO presigned PUT/GET with expiry |
| **Secrets** | Environment isolation | .env never committed; secrets manager |
| **API** | CORS whitelist | Exact origins only |
| **Audit** | Async audit trail | AuditProcessor writes before/after snapshots |

### Security Checklist

| Item | Status | Notes |
|---|---|---|
| JWT secret minimum 32 chars | Configured | Zod validation enforced |
| Redis password in production | To implement | Required for prod |
| TLS on all external endpoints | To implement | Reverse proxy required |
| Rate limiting on auth | To implement | @nestjs/throttler |
| Security scan in CI/CD | To implement | Trivy integration |
| Dependency audit in CI/CD | To implement | npm audit |
| Network segmentation | Partial | Docker bridge; no further segmentation |
| WAF (Web Application Firewall) | Not planned | Consider in future |
| Penetration testing | Not planned | Recommended annually |

### Dependency Security

```bash
# Audit production dependencies
docker exec edusystem-api npm audit --production

# Scan container images
trivy image edusystem-api:latest

# Check for known vulnerabilities
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy:latest image edusystem-api:latest
```

### Security Hardening for Docker

```yaml
# docker-compose.prod.yml
services:
  api:
    security_opt:
      - no-new-privileges:true
    read_only: false  # Allow /tmp for temporary files
    tmpfs:
      - /tmp:size=10M,mode=1777
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
      nproc:
        soft: 4096
        hard: 4096
```

---

## 26. Performance Considerations

### Bottleneck Analysis

| Component | Bottleneck | Impact | Mitigation |
|---|---|---|---|
| **PDF Generation** | Puppeteer + Chromium | High CPU (~2 cores), ~5s per PDF | Serial processing in worker; shared browser instance; scale workers |
| **Large bulk grade imports** | Prisma transactions | Long transactions, connection blocking | Batch in chunks of 500; background processing |
| **Notification batch sends** | FCM rate limits | 1000 concurrent limit per connection | BullMQ serializes; exponential backoff |
| **Avatar/logo serving** | MinIO direct access | No caching headers | Add CDN; set `Cache-Control` on presigned URLs |
| **Database queries** | Missing indexes | Slow filters on large tables | Index `institutionId` on all tenant tables; `courseSubject.teacherId` |
| **N+1 queries** | Prisma `include` misuse | Multiple round trips | Use `select` with nested `select`; dataloader pattern |
| **Web SSR** | Next.js SSR on every request | Slow page loads | Enable ISR (Incremental Static Regeneration); SSR only for auth-required pages |

### Performance Tuning

| Component | Tuning | Effect |
|---|---|---|
| **Prisma** | `connection_limit=20` in prod | More concurrent DB connections |
| **Prisma** | `log: ['warn']` in prod | Reduce log volume |
| **PostgreSQL** | `shared_buffers=1GB` | Better query caching |
| **PostgreSQL** | `work_mem=64MB` | Faster sort/hash operations |
| **Redis** | `maxmemory 512mb` | More room for queue jobs |
| **MinIO** | Enable erasure coding | Better I/O for large files |
| **Next.js** | ISR with `revalidate: 60` | Reduce SSR load for public pages |

### Caching Strategy (Future)

| Data | Cache Location | TTL | Invalidation |
|---|---|---|---|
| Institution settings | Redis | 5 minutes | On PATCH /institutions/:id |
| User roles | Redis | 10 minutes | On role change |
| Navigation config | Redis | 15 minutes | On navigation edit |
| Presigned URLs | In-memory (client) | Per URL expiry | N/A |

Current state: **No application-level caching.** Redis is only used as a BullMQ broker. Future: Redis caching for hot reads to reduce PostgreSQL load.

---

## 27. Infrastructure Tradeoffs

| Tradeoff | Decision | Rationale | Cost |
|---|---|---|---|
| **Single-host vs Kubernetes** | Single-host Docker Compose | Team size and operational complexity favor simpler deployment for target scale | No auto-scaling or rolling updates; manual restarts |
| **Shared-schema vs Schema-per-tenant** | Shared-schema with `institutionId` | Lower operational overhead, simpler migrations, shared resources | Application-layer isolation only; compromised query could leak data |
| **Redis AOF vs no persistence** | AOF everysec | No job loss on restart; reasonable performance tradeoff | Slight I/O overhead; acceptable for EduSystem load |
| **MinIO vs AWS S3** | MinIO for self-hosted | No vendor lock-in, no egress costs, same Docker environment | More operational work; no managed SLA |
| **Dual-mode backend** | Same codebase, different APP_MODE | No code duplication; same Prisma schema, same validation | Workers need restart to pick up API code changes |
| **Sync vs Async audit logging** | Async via BullMQ | Audit writes never block API responses | Small risk of audit log loss if Redis fails before job completes |
| **No caching layer** | Redis only for queues | Simpler architecture; no cache invalidation logic needed | Hot reads go directly to PostgreSQL; potential load at scale |
| **JWT decode in TenantMiddleware** | Decode without verify | Extracts tenant context early without duplicating verification | Non-obvious security behavior; relies on JwtAuthGuard for enforcement |
| **PDF in Worker vs API** | Worker for bulk, API for single | Single PDFs are fast for sync; bulk requires background | Two code paths for PDF generation |
| **NextAuth v5 beta** | Used for frontend auth | Latest features and improved session handling | Beta software may introduce breaking changes |

---

## 28. Future Infrastructure Evolution

### Near-term (0-6 months)

| Item | Description | Priority | Effort |
|---|---|---|---|
| **Redis password** | Enable `REDIS_PASSWORD` in production | High | Low |
| **TLS termination** | Add nginx/Caddy reverse proxy with HTTPS | High | Medium |
| **Rate limiting** | Add `@nestjs/throttler` on auth endpoints | High | Low |
| **Structured logging** | Migrate to Pino JSON logging | Medium | Medium |
| **Metrics** | Add Prometheus + Grafana dashboards | Medium | Medium |
| **Trivy in CI** | Add container security scanning | Medium | Low |
| **Connection pooling** | Add PgBouncer between API and PostgreSQL | Medium | Medium |
| **Read replica** | Add PostgreSQL read replica for reporting | Medium | Medium |

### Mid-term (6-18 months)

| Item | Description | Priority | Effort |
|---|---|---|---|
| **Kubernetes migration** | Migrate from Docker Compose to Kubernetes for auto-scaling and rolling updates | Medium | High |
| **Redis Cluster** | Deploy Redis Sentinel/Cluster for HA | Medium | Medium-High |
| **CDN** | Add CDN (Cloudflare, AWS CloudFront) for static assets | Medium | Medium |
| **Webhook system** | Add outbound webhooks for integration with external systems | Low | Medium |
| **WebSocket / SSE** | Replace 30-second notification polling with real-time updates | Medium | High |
| **Redis caching** | Implement application-level caching for hot data | Low | Medium |
| **Distributed MinIO** | MinIO in distributed mode or AWS S3 migration | Low | Medium |
| **Service mesh** | Consider Istio/Linkerd for mTLS, traffic management | Low | High |

### Long-term (18+ months)

| Item | Description | Priority | Effort |
|---|---|---|---|
| **Multi-host deployment** | Scale to multiple hosts with shared storage and load balancer | Low | High |
| **GraphQL API** | Consider GraphQL layer for mobile (reduce over-fetching) | Low | High |
| **Data warehouse** | Export anonymized data to BigQuery/Snowflake for analytics | Low | High |
| **Disaster recovery automation** | Automated DR drills and runbook execution | Medium | Medium |
| **Observability platform** | Full observability: logs, metrics, traces, profiling | Medium | Medium |
| **Chaos engineering** | LitmusChaos for fault injection testing | Low | Medium |

### Kubernetes Migration Path

When migrating from Docker Compose to Kubernetes:

1. **Containerize all services** — Already done (Dockerfiles exist)
2. **Add health checks** — Already implemented (healthcheck in compose)
3. **Externalize secrets** — Migrate from `.env` to Kubernetes Secrets / Vault
4. **Add Helm charts** — Create Helm charts for each service
5. **Add Ingress controller** — nginx-ingress or Traefik for routing
6. **Add service mesh** — Istio for mTLS between services
7. **Add HPA** — Horizontal Pod Autoscaler based on CPU/memory/request metrics

```yaml
# Example HPA for API service
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: edusystem-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: edusystem-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

*Document generated for EduSystem v2.1. For questions or corrections, contact the platform engineering team.*