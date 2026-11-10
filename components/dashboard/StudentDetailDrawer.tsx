"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CARD_COLOR_STYLES, type CardColor } from "@/lib/cardColors";
import { cn } from "@/lib/utils";
import type { DashboardStudent } from "@/services/dashboardService";

export function StudentDetailDrawer({
  open,
  onOpenChange,
  title,
  icon: Icon,
  color,
  students,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: LucideIcon;
  color: CardColor;
  students: DashboardStudent[];
}) {
  const styles = CARD_COLOR_STYLES[color];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="top-0 right-0 bottom-0 left-auto grid w-full max-w-md translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-0 rounded-none p-0 sm:max-w-md data-open:slide-in-from-right data-closed:slide-out-to-right"
      >
        <DialogHeader className={cn("gap-0 border-b px-5 py-4", styles.bg)}>
          <div className="flex items-center gap-3">
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", styles.iconBg, styles.iconText)}>
              <Icon className="size-5" />
            </div>
            <div>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>
                {students.length} student{students.length === 1 ? "" : "s"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-5 py-4">
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students in this group.</p>
          ) : (
            <ul className="space-y-3">
              {students.map((s) => (
                <li key={s.id} className="rounded-lg border p-3">
                  <Link href={`/students/${s.id}`} className="font-medium hover:underline">
                    {s.first_name} {s.last_name}
                  </Link>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="capitalize">{s.gender}</Badge>
                    {s.province_name && <Badge variant="outline">{s.province_name}</Badge>}
                    {s.ngo_name ? (
                      <Badge variant="secondary">{s.ngo_name}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">No NGO</Badge>
                    )}
                  </div>
                  {s.elimination_reason && (
                    <p className="mt-2 rounded-md bg-rose-50 p-2 text-xs whitespace-pre-wrap text-rose-700">
                      <span className="font-medium">Reason: </span>
                      {s.elimination_reason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
