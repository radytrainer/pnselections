"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({
  value,
  onChange,
  disabled,
  size = "default",
}: {
  value: number;
  onChange?: (score: number) => void;
  disabled?: boolean;
  size?: "default" | "sm";
}) {
  const iconSize = size === "sm" ? "size-3.5" : "size-4";

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onChange || disabled}
          onClick={() => onChange?.(star)}
          aria-label={`Rate ${star} out of 5`}
          className={cn(
            "disabled:cursor-default",
            onChange && !disabled && "cursor-pointer hover:scale-110 transition-transform",
          )}
        >
          <Star
            className={cn(
              iconSize,
              star <= value ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}
