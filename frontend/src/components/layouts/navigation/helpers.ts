import type { NavigationConfig, NavGroup, NavItem } from './types';
import { navigationByRole } from './config';

export function getNavConfig(role: string | undefined): NavigationConfig {
  return navigationByRole[role ?? ''] ?? navigationByRole.TEACHER;
}

export function getDashboardHref(role: string | undefined): string {
  switch (role) {
    case 'ADMIN':
    case 'DIRECTOR':
    case 'SECRETARY':
    case 'PRECEPTOR':
    case 'SUPER_ADMIN':
      return '/admin/dashboard';
    case 'GUARDIAN':
      return '/guardian/dashboard';
    default:
      return '/teacher/dashboard';
  }
}

export function isNavItemActive(
  pathname: string,
  item: NavItem,
  dashboardHref: string,
): boolean {
  if (!item.href) {
    if (item.children) {
      return item.children.some((child) =>
        isNavItemActive(pathname, child, dashboardHref),
      );
    }
    return false;
  }

  if (pathname === item.href) return true;

  if (item.href !== dashboardHref && pathname.startsWith(item.href + '/')) {
    return true;
  }

  return false;
}

export function isGroupActive(
  pathname: string,
  group: NavGroup,
  dashboardHref: string,
): boolean {
  return group.items.some((item) =>
    isNavItemActive(pathname, item, dashboardHref),
  );
}

export function findActiveItem(
  pathname: string,
  config: NavigationConfig,
  dashboardHref: string,
): { groupIndex: number; item: NavItem } | null {
  if (isNavItemActive(pathname, config.dashboard, dashboardHref)) {
    return { groupIndex: -1, item: config.dashboard };
  }

  for (let i = 0; i < config.groups.length; i++) {
    const group = config.groups[i];
    for (const item of group.items) {
      if (isNavItemActive(pathname, item, dashboardHref)) {
        return { groupIndex: i, item };
      }
    }
  }

  return null;
}

export function isAnyItemActive(
  pathname: string,
  config: NavigationConfig,
  dashboardHref: string,
): boolean {
  if (isNavItemActive(pathname, config.dashboard, dashboardHref)) return true;
  return config.groups.some((group) => isGroupActive(pathname, group, dashboardHref));
}
