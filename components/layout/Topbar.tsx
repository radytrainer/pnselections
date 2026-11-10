"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { ChevronDown, Menu, Settings, LogOut } from "lucide-react";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SidebarNav } from "@/components/layout/Sidebar";
import { initials } from "@/lib/initials";

export function Topbar() {
  const { user } = useAuth();
  const { role } = useRole();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function handleSignOut() {
    await signOut(getFirebaseAuth());
    router.replace("/login");
  }

  const displayName = user?.displayName || user?.email || "Account";

  return (
    <header className="flex h-14 items-center justify-between border-b px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="sm:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="size-5" />
        </Button>
        {role && (
          <Badge variant="outline" className="capitalize">
            {role.replace(/_/g, " ")}
          </Badge>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="h-9 gap-2 px-1.5 sm:px-2.5"
              aria-label="Account menu"
            />
          }
        >
          <Avatar className="size-7">
            <AvatarImage src={user?.photoURL ?? undefined} alt={displayName} />
            <AvatarFallback>{initials(displayName)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-40 truncate text-sm sm:inline">{displayName}</span>
          <ChevronDown className="hidden size-3.5 text-muted-foreground sm:inline" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
            <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/account" />}>
            <Settings className="size-4" />
            My Account
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 h-full w-72 max-w-[85%] translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-4 rounded-none border-r p-4 data-open:slide-in-from-left data-open:zoom-in-100 data-closed:slide-out-to-left data-closed:zoom-out-100"
        >
          <DialogTitle className="px-2 text-sm font-semibold tracking-tight">
            PNC Selection
          </DialogTitle>
          <SidebarNav role={role} onNavigate={() => setMobileNavOpen(false)} />
        </DialogContent>
      </Dialog>
    </header>
  );
}
