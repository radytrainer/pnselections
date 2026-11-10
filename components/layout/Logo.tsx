import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 20.5 16 24l7-3.5M9 16 16 19.5 23 16M16 8 9 11.5 16 15l7-3.5L16 8Z"
        className="stroke-primary-foreground"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <div className="leading-tight">
        <p className="text-sm font-semibold">Scholarship Selection Tracker</p>
        <p className="text-xs text-muted-foreground">NGO Education Partnership</p>
      </div>
    </div>
  );
}
