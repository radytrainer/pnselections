import Image from "next/image";
import { cn } from "@/lib/utils";

/** Passerelles Numériques round "PN" mark (public/brand/pn-mark.png). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/pn-mark.png"
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      unoptimized
      className={cn("size-8 shrink-0", className)}
    />
  );
}

/**
 * Full Passerelles Numériques logo with the product name underneath.
 * `tone="light"` is the white-text version for dark/blue backgrounds.
 */
export function Logo({
  className,
  tone = "dark",
  showProduct = true,
  logoClassName,
}: {
  className?: string;
  tone?: "dark" | "light";
  showProduct?: boolean;
  logoClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <Image
        src={tone === "light" ? "/brand/pn-logo-white.png" : "/brand/pn-logo.png"}
        alt="Passerelles Numériques — A Gateway for Life"
        width={1400}
        height={594}
        priority
        unoptimized
        className={cn("h-14 w-auto", logoClassName)}
      />
      {showProduct && (
        <p
          className={cn(
            "text-xs font-medium tracking-wide uppercase",
            tone === "light" ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          Scholarship Selection Tracker
        </p>
      )}
    </div>
  );
}
