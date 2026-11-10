"use client";

import { WifiOff } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Logo />
      <WifiOff className="size-12 text-muted-foreground" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          This page hasn&apos;t been loaded before, so it isn&apos;t available without a connection.
        </p>
      </div>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}
