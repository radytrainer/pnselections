"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  Gavel,
  LayoutDashboard,
  Map as MapIcon,
  MessageCircleQuestionMark,
  School,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  {
    href: "/students/trash",
    label: "Trash",
    icon: Trash2,
    roles: ["super_admin", "program_manager", "selection_team"],
  },
  { href: "/admin/users", label: "Users", icon: ShieldCheck, roles: ["super_admin"] },
  {
    href: "/admin/interview-questions",
    label: "Interview Questions",
    icon: MessageCircleQuestionMark,
    roles: ["super_admin"],
  },
];

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
  const items = NAV_ITEMS.filter((item) => !item.roles || (role && item.roles.includes(role)));

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const linkClassName = cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium tracking-tight transition-colors",
          collapsed && "justify-center px-2",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        );
        const content = (
          <>
            <item.icon className="size-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        );

        if (!collapsed) {
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} className={linkClassName}>
              {content}
            </Link>
          );
        }

        return (
          <Tooltip key={item.href}>
            <TooltipTrigger
              render={<Link href={item.href} onClick={onNavigate} className={linkClassName} />}
            >
              {content}
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        );
      })}
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
        {!collapsed && <span className="truncate">PNC Selection</span>}
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
