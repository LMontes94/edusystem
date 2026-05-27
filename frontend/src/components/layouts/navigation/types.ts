import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  name: string;
  href?: string;
  icon?: LucideIcon;
  children?: NavItem[];
  roles?: string[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
  roles?: string[];
};

export type NavigationConfig = {
  dashboard: NavItem;
  groups: NavGroup[];
};
