'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';

import { useAppSession } from '@/lib/hooks/use-app-session';
import { cn } from '@/lib/utils';
import { getNavConfig, getDashboardHref, isNavItemActive } from '../navigation/helpers';
import { SidebarBrand } from './sidebar-brand';
import { SidebarUser } from './sidebar-user';
import type { NavItem as NavItemType } from '../navigation/types';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';

import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

function NavItem({
  item,
  pathname,
  dashboardHref,
  onNavClick,
}: {
  item: NavItemType;
  pathname: string;
  dashboardHref: string;
  onNavClick: () => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isParentActive = hasChildren
    ? item.children.some((child) =>
        isNavItemActive(pathname, child, dashboardHref),
      )
    : false;
  const isActive = !hasChildren && isNavItemActive(pathname, item, dashboardHref);
  const [open, setOpen] = useState(isParentActive);

  useEffect(() => {
    setOpen(isParentActive);
  }, [isParentActive]);

  if (!hasChildren) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={item.name}
          className={cn(
            'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0',
            isActive &&
              'border-l-2 border-l-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium',
          )}
        >
          <Link href={item.href!} onClick={onNavClick}>
            {item.icon && <item.icon className="size-[18px] stroke-[1.5]" />}
            <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.name}
            className={cn(
              'group/collapsible group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0',
              isParentActive &&
                'border-l-2 border-l-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium',
            )}
          >
            {item.icon && <item.icon className="size-[18px] stroke-[1.5]" />}
            <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
            <ChevronDown
              className={cn(
                'ml-auto h-4 w-4 shrink-0 transition-transform duration-200 group-data-[collapsible=icon]:hidden',
                open && 'rotate-180',
              )}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
      </SidebarMenuItem>
      <CollapsibleContent>
        <SidebarMenuSub>
          {item.children.map((child) => {
            const isChildActive = isNavItemActive(pathname, child, dashboardHref);
            return (
              <SidebarMenuSubItem key={child.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={isChildActive}
                  className={cn(
                    isChildActive &&
                      'border-l-2 border-l-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium',
                  )}
                >
                  <Link href={child.href!} onClick={onNavClick}>
                    {child.name}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            );
          })}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AppSidebar() {
  const { data: session } = useAppSession();
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar();
  const user = session?.user as { role?: string } | undefined;
  const role = user?.role;
  const config = getNavConfig(role);
  const dashboardHref = getDashboardHref(role);

  const isDashboardActive = isNavItemActive(pathname, config.dashboard, dashboardHref);

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent className="group-data-[collapsible=icon]:overflow-auto">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isDashboardActive}
              tooltip={config.dashboard.name}
              className={cn(
                'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0',
                isDashboardActive &&
                  'border-l-2 border-l-primary bg-sidebar-accent text-sidebar-accent-foreground font-medium',
              )}
            >
              <Link href={config.dashboard.href!} onClick={handleNavClick}>
                {config.dashboard.icon && (
                  <config.dashboard.icon className="size-[18px] stroke-[1.5]" />
                )}
                <span className="group-data-[collapsible=icon]:hidden">{config.dashboard.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator />

        {config.groups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItem
                    key={item.name}
                    item={item}
                    pathname={pathname}
                    dashboardHref={dashboardHref}
                    onNavClick={handleNavClick}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
