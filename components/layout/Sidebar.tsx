"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Building2,
  DatabaseBackup,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  History,
  Gavel,
  LayoutDashboard,
  Map as MapIcon,
  MessageCircleQuestionMark,
  School,
  Settings,
  ShieldCheck,
  Trash2,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/layout/Logo";
import type { AppRole } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles that can see this nav item; omit to show to every authenticated role. */
  roles?: AppRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/selection-process",
    label: "Selection Process",
    icon: ClipboardList,
    roles: [
      "super_admin",
      "program_manager",
      "selection_team",
      "interview_team",
      "home_visit_team",
      "committee_member",
    ],
  },
  { href: "/map", label: "Cambodia Map", icon: MapIcon },
  {
    href: "/students",
    label: "Students",
    icon: GraduationCap,
    roles: [
      "super_admin",
      "program_manager",
      "selection_team",
      "interview_team",
      "home_visit_team",
    ],
  },
  {
    href: "/field",
    label: "Field Mode (Offline)",
    icon: WifiOff,
    roles: ["super_admin", "program_manager", "selection_team", "interview_team", "home_visit_team"],
  },
  {
    href: "/committee/queue",
    label: "Committee Queue",
    icon: Gavel,
    roles: ["super_admin", "program_manager", "selection_team", "committee_member", "home_visit_team"],
  },
  {
    href: "/ngos",
    label: "NGO Partners",
    icon: Building2,
    roles: [
      "super_admin",
      "program_manager",
      "selection_team",
      "interview_team",
      "ngo_partner",
      "donor",
    ],
  },
  {
    href: "/schools",
    label: "School Partners",
    icon: School,
    roles: [
      "super_admin",
      "program_manager",
      "selection_team",
      "interview_team",
      "ngo_partner",
      "donor",
    ],
  },
  {
    href: "/finalist",
    label: "Finalists",
    icon: Award,
    roles: ["super_admin", "program_manager", "selection_team", "committee_member"],
  },
  { href: "/admin/users", label: "Users", icon: ShieldCheck, roles: ["super_admin"] },
];

/** Settings-type pages, grouped under one collapsible "Configuration" entry. */
export const CONFIG_ITEMS: NavItem[] = [
  {
    href: "/students/trash",
    label: "Trash",
    icon: Trash2,
    roles: ["super_admin", "program_manager", "selection_team"],
  },
  {
    href: "/admin/cycles",
    label: "Selection Cycles",
    icon: CalendarRange,
    roles: ["super_admin", "program_manager"],
  },
  {
    href: "/admin/interview-questions",
    label: "Interview Questions",
    icon: MessageCircleQuestionMark,
    roles: ["super_admin"],
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    icon: History,
    roles: ["super_admin", "program_manager"],
  },
  {
    href: "/admin/backup",
    label: "Backup",
    icon: DatabaseBackup,
    roles: ["super_admin"],
  },
];

const CONFIG_OPEN_STORAGE_KEY = "sidebar-config-open";

function visibleFor(items: NavItem[], role: AppRole | null) {
  return items.filter((item) => !item.roles || (role && item.roles.includes(role)));
}

/** The one item to highlight: the longest href matching the URL (so /students/trash highlights Trash, not Students). */
function activeHref(pathname: string, items: NavItem[]) {
  return items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .reduce<string | null>((best, item) => (!best || item.href.length > best.length ? item.href : best), null);
}

function NavLink({
  item,
  active,
  collapsed,
  nested = false,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const className = cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium tracking-tight transition-colors",
    collapsed && "justify-center px-2",
    nested && !collapsed && "pl-9",
    active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
  const content = (
    <>
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </>
  );

  if (!collapsed) {
    return (
      <Link href={item.href} onClick={onNavigate} className={className} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={item.href}
            onClick={onNavigate}
            className={className}
            aria-current={active ? "page" : undefined}
          />
        }
      >
        {content}
      </TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: {
  role: AppRole | null;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = visibleFor(NAV_ITEMS, role);
  const configItems = visibleFor(CONFIG_ITEMS, role);
  const current = activeHref(pathname, [...items, ...configItems]);
  const configActive = configItems.some((item) => item.href === current);

  // Open state is remembered per browser; the group always opens when you're on one of its pages.
  const [configOpen, setConfigOpen] = useState(false);
  useEffect(() => {
    try {
      setConfigOpen(localStorage.getItem(CONFIG_OPEN_STORAGE_KEY) === "1");
    } catch {
      // storage unavailable: start closed
    }
  }, []);
  useEffect(() => {
    if (configActive) setConfigOpen(true);
  }, [configActive]);

  function toggleConfig() {
    setConfigOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(CONFIG_OPEN_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={item.href === current}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      ))}

      {configItems.length > 0 &&
        (collapsed ? (
          // Icon-only sidebar: no room for a dropdown, so show the pages as icons under a divider.
          <>
            <div className="mx-2 my-1 border-t" role="separator" aria-label="Configuration" />
            {configItems.map((item) => (
              <NavLink key={item.href} item={item} active={item.href === current} collapsed onNavigate={onNavigate} />
            ))}
          </>
        ) : (
          <div>
            <button
              type="button"
              onClick={toggleConfig}
              aria-expanded={configOpen}
              aria-controls="sidebar-config-group"
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium tracking-tight transition-colors",
                configActive && !configOpen
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Settings className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left">Configuration</span>
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform duration-150", configOpen && "rotate-180")}
              />
            </button>
            {configOpen && (
              <div id="sidebar-config-group" className="mt-1 flex flex-col gap-1">
                {configItems.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={item.href === current}
                    collapsed={false}
                    nested
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
    </nav>
  );
}

export function Sidebar({ role }: { role: AppRole | null }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden flex-col overflow-y-auto border-r bg-background p-3 transition-[width] duration-150 sm:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "mb-6 flex items-center px-2 text-sm font-semibold tracking-tight",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <span className="flex min-w-0 items-center gap-2">
            <LogoMark className="size-7" />
            <span className="truncate">PNC Selection</span>
          </span>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
      </div>
      <SidebarNav role={role} collapsed={collapsed} />
    </aside>
  );
}
