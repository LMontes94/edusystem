# Sidebar Navigation Architecture

> **Version:** 1.0
> **Last Updated:** 2026-05-26
> **Classification:** Internal — Frontend Architecture
> **Audience:** Frontend Engineers, AI Coding Agents

---

## 1. Purpose

This document describes the **config-driven, domain-grouped navigation architecture** used in EduSystem's sidebar. It covers the design decisions, implementation structure, rendering flow, and conventions that govern sidebar navigation.

The sidebar is the primary navigation interface for all authenticated users. It is role-aware, responsive, and built on shadcn `Sidebar` primitives.

---

## 2. Navigation Philosophy

EduSystem navigation follows three core principles:

### 2.1 Functional Domains over User Roles

Sidebar groups represent **functional domains** (e.g., "ADMINISTRACIÓN", "GESTIÓN DOCENTE", "CONVIVENCIA"), not user roles. A "GESTIÓN DOCENTE" group contains Temario, Notas, Pendientes — regardless of whether the user is ADMIN or TEACHER. The role determines **which groups are visible**, not what they're called.

### 2.2 Config-Driven over Hardcoded Components

All navigation items are defined in `navigation/config.ts` as plain typed objects. The `AppSidebar` component reads these configs and renders them using shadcn Sidebar primitives. No sidebar item is ever hardcoded inside a component.

### 2.3 Scalability over Quick Fixes

The architecture is designed for 10+ domain groups, 50+ navigation items, and future extensibility (badges, permissions, superadmin). Every design decision prioritizes long-term maintainability over short-term convenience.

---

## 3. Why Not the Old Way

The previous custom sidebar had these problems:

| Problem | Old Approach | New Approach |
|---------|-------------|-------------|
| Flat list | All items in a single list | Groups with labeled sections |
| Fake separators | String labels like `'— Panel —'` between sections | `SidebarGroupLabel` with proper semantics |
| Mixed domains | Academic and admin items interleaved | Clear domain groupings |
| No nesting | All items at same level | `children` array with Collapsible |
| No collapsible | Always expanded | shadcn `collapsible="icon"` mode |
| Parallel implementation | Custom `AppSidebar` bypassing shadcn | Uses shadcn `Sidebar` primitives |
| Aggressive active state | Full `bg-primary` background | Subtle `border-l-2` indicator |
| Distributed logic | Navigation scattered across files | Single config source of truth |

---

## 4. Navigation Structure

### 4.1 Type Definitions

```typescript
// navigation/types.ts

export type NavItem = {
  name: string;            // Display label
  href?: string;           // Route path (optional for container-only parents)
  icon?: LucideIcon;       // Lucide icon component
  children?: NavItem[];    // Nested sub-items (rendered in Collapsible)
  roles?: string[];        // Future: granular permission filtering
};

export type NavGroup = {
  title: string;           // Group label (e.g., "ADMINISTRACIÓN")
  items: NavItem[];        // Items within this group
  roles?: string[];        // Future: group-level permission filtering
};

export type NavigationConfig = {
  dashboard: NavItem;      // Standalone top item (outside groups)
  groups: NavGroup[];      // Domain groups
};
```

### 4.2 Key Design Decisions

- **`children` not `items`**: Uses `children` to avoid ambiguity between `NavItem` (a single entry) and `items` (a collection). An item with `children` is a collapsible parent; an item without is a leaf.
- **`href` optional**: Container-only parents (e.g., a Deportes parent that groups Grupos and Torneos) can omit `href`. Clickable parents (e.g., Deportes that links to `/admin/deportes` while also having children) include it.
- **Dashboard standalone**: Dashboard has no group. It renders outside any `SidebarGroup`, separated by a visual divider.

---

## 5. Navigation Config

### 5.1 File: `navigation/config.ts`

Five role-specific configs are defined:

| Config | Roles | Purpose |
|--------|-------|---------|
| `adminNav` | ADMIN, DIRECTOR, SECRETARY | Full institutional management |
| `preceptorNav` | PRECEPTOR | Attendance + student management |
| `teacherNav` | TEACHER | Academic management (temario, grades) |
| `guardianNav` | GUARDIAN | Children tracking (grades, attendance, convivencia) |
| `superadminNav` | SUPER_ADMIN | Platform-wide administration |

### 5.2 Role Mapping

```typescript
export const navigationByRole: Record<string, NavigationConfig> = {
  ADMIN: adminNav,
  DIRECTOR: adminNav,
  SECRETARY: adminNav,
  PRECEPTOR: preceptorNav,
  TEACHER: teacherNav,
  GUARDIAN: guardianNav,
  SUPER_ADMIN: superadminNav,
};

export function getNavConfig(role: string | undefined): NavigationConfig {
  return navigationByRole[role ?? ''] ?? teacherNav;
}
```

### 5.3 Domain Groups

| Group | Items | Visible To |
|-------|-------|-----------|
| ADMINISTRACIÓN | Usuarios, Alumnos, Cursos, Materias | admin, director, secretary, preceptor |
| ACADÉMICO | Asistencia, Evaluaciones, Indicadores, Reportes | admin, director, secretary, preceptor, teacher |
| GESTIÓN DOCENTE | Temario, Notas, Pendientes | admin, director, secretary, teacher |
| CONVIVENCIA | Convivencia | admin, director, secretary, preceptor, guardian |
| INSTITUCIÓN | Comunicados, Espacios, Calendario | all roles |
| ACTIVIDADES | Deportes, Grupos Edu. Física | admin, director, secretary |

---

## 6. Rendering Flow

```
User authenticates
    → AppLayout renders SidebarProvider
        → AppSidebar resolves role from session
            → getNavConfig(role) returns NavigationConfig
                → shadcn Sidebar renders Dashboard item
                → shadcn SidebarGroup renders each domain group
                    → SidebarMenu renders NavItem
                        → Collapsible wraps items with children
```

### 6.1 Sequence

1. `getNavConfig(role)` — retrieves the config for the user's highest role
2. `isNavItemActive(item, pathname)` — evaluates active state for each item
3. shadcn `Sidebar` — renders the shell (collapsible, responsive, mobile sheet)
4. `SidebarGroup` — renders each domain group with `SidebarGroupLabel`
5. `SidebarMenu` — renders items with icons, labels, and tooltips
6. `Collapsible` — wraps parent items to show/hide children

---

## 7. Active State Logic

### 7.1 Rules

| Item Type | Active Condition |
|-----------|-----------------|
| Dashboard | `pathname === href` (exact match) |
| Regular item | `pathname === href \|\| pathname.startsWith(href + '/')` |
| Nested item | Same as regular item |
| Parent item | Active if any child is active |

### 7.2 False Positive Prevention

The `startsWith(href + '/')` pattern prevents false matches:

```
href = "/admin/attendance"
pathname = "/admin/attendance-detail"  →  "/admin/attendance-detail".startsWith("/admin/attendance/")  →  false ✓
pathname = "/admin/attendance"          →  "/admin/attendance".startsWith("/admin/attendance/")          →  false ✓
pathname = "/admin/attendance/take"     →  "/admin/attendance/take".startsWith("/admin/attendance/")      →  true  ✓
```

Without the trailing `/`, `/admin/attendance` would match `/admin/attendance-detail`.

### 7.3 Visual Indicator

Active items use:
- `border-l-2 border-l-primary` — subtle left border
- `bg-sidebar-accent text-sidebar-accent-foreground` — soft background
- `font-medium` — bold text

---

## 8. Collapsible Behavior

### 8.1 Sidebar Collapsible Mode

The sidebar uses `collapsible="icon"` from shadcn. In icon mode:
- Icons are shown, labels hidden
- Tooltips appear on hover for icon-only items
- Hovering the sidebar expands it temporarily
- Clicking the `SidebarTrigger` toggles between expanded and icon mode

### 8.2 Nested Item Collapsible

Only items with `children` are wrapped in `Collapsible`:
- `CollapsibleTrigger` shows the item name with a chevron icon
- `CollapsibleContent` shows the children
- The collapsible is open by default if any child is active

### 8.3 Keyboard Shortcut

`Ctrl+B` toggles sidebar expand/collapse mode. State is persisted via cookies by shadcn `SidebarProvider`.

---

## 9. Responsive Behavior

| Viewport | Sidebar Mode | Behavior |
|----------|-------------|----------|
| Desktop (md+) | Collapsible sidebar | Persistent sidebar with expand/collapse |
| Mobile (<md) | Sheet overlay | Sidebar slides in from left; backdrop closes it |
| Transition | Auto | shadcn `SidebarProvider` handles breakpoint detection |

---

## 10. Conventions

### 10.1 Groups

- Groups are **always visible** — never wrapped in accordion or collapsible
- Each group has a `SidebarGroupLabel` in uppercase Spanish
- Groups render in the order defined in `config.ts`

### 10.2 Nested Items

- Only nested items (`NavItem.children`) are wrapped in `Collapsible`
- Parent items with `href` are clickable links
- Parent items without `href` are container-only (non-clickable)

### 10.3 Dashboard

- Standalone outside any group
- Renders as a `SidebarMenuItem` above a `SidebarSeparator`
- Uses exact pathname matching (no `startsWith`)

### 10.4 Chat

- **Excluded from sidebar** — access is via the header icon only
- Chat navigation must NOT be added to sidebar configs

### 10.5 Icons

- All icons use `lucide-react`
- Size: `size-[18px]`
- Stroke width: `stroke-[1.5]`
- Consistent across all nav items

### 10.6 SidebarUser (Footer)

- Renders at the bottom of the sidebar (`SidebarFooter`)
- Shows user avatar, name, and email
- Dropdown menu with: Perfil, Settings (admin only), Cerrar sesión

---

## 11. Anti-Patterns

| Anti-Pattern | Why |
|-------------|-----|
| Hardcoding sidebar items in components | Breaks config-driven architecture |
| Creating role-specific sidebar components | One `AppSidebar` renders all configs |
| Using string separators as section labels | Use `SidebarGroupLabel` for proper semantics |
| Adding Chat to the sidebar | Access is via header icon only |
| Using custom sidebar implementations | Must use shadcn `Sidebar` primitives |
| Making groups collapsible/accordion | Groups are always visible |
| Duplicating route definitions in components | Define once in `config.ts` |
| Distributing navigation logic across components | All logic in `navigation/` directory |

---

## 12. Future Extensibility

### 12.1 Granular Permissions

The `roles?: string[]` field on `NavItem` and `NavGroup` is prepared for fine-grained per-item authorization:

```typescript
{
  title: 'REPORTES AVANZADOS',
  items: [ /* ... */ ],
  roles: ['ADMIN', 'DIRECTOR'],  // Only ADMIN and DIRECTOR see this group
}
```

This can be combined with frontend CASL or a simpler role array check.

### 12.2 Badge Counters

`SidebarMenuBadge` can be added to items for notification counts, pending grades, unread announcements, etc.

### 12.3 SuperAdmin Navigation

The `superadminNav` config is prepared with platform-wide modules: institution management, global settings, system logs, and tenant switching.

### 12.4 Analytics & Metrics

Dedicated groups for charts, dashboards, and KPI sections can be added without structural changes.

### 12.5 Multi-Tenant Admin Routes

Cross-institution routes for superadmin are supported by the config structure without special-casing.

---

## 13. Related Files

| File | Role |
|------|------|
| `frontend/src/components/layouts/navigation/types.ts` | Type definitions |
| `frontend/src/components/layouts/navigation/config.ts` | Role-specific configs |
| `frontend/src/components/layouts/navigation/helpers.ts` | Active state, config resolution |
| `frontend/src/components/layouts/components/sidebar.tsx` | shadcn Sidebar rendering |
| `frontend/src/components/layouts/components/sidebar-user.tsx` | Sidebar footer |
| `frontend/src/components/layouts/components/sidebar-brand.tsx` | Sidebar header brand |
| `frontend/src/components/layouts/components/app-header.tsx` | Header with SidebarTrigger |
| `frontend/src/components/layouts/app-layout.tsx` | SidebarProvider wrapper |
| `frontend/src/components/ui/collapsible.tsx` | Radix Collapsible wrapper |
| `docs/frontend/sidebar-navigation-architecture.md` | This document |
| `docs/ARCHITECTURE.md` (section 5.6) | High-level navigation architecture |
| `docs/engineering/frontend-patterns.md` (section 34) | Navigation engineering patterns |

---

*Document maintained alongside the codebase. Update when navigation structure, rendering flow, or conventions change.*
