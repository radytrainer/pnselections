"use client";

import { useState } from "react";
import { toast } from "sonner";
import { upsertCommitteeRating } from "@/services/committeeService";
import type { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";

type CommitteeRatingRow = Database["public"]["Tables"]["committee_ratings"]["Row"];

/** Red → green scale so the circle border communicates score at a glance. */
const SCORE_STYLES: Record<number, { border: string; selectedBg: string }> = {
  1: { border: "border-red-500", selectedBg: "border-red-500 bg-red-500" },
  2: { border: "border-red-300", selectedBg: "border-red-300 bg-red-300" },
  3: { border: "border-orange-400", selectedBg: "border-orange-400 bg-orange-400" },
  4: { border: "border-green-300", selectedBg: "border-green-300 bg-green-300" },
  5: { border: "border-green-500", selectedBg: "border-green-500 bg-green-500" },
};

/** Only mounted for roles that can vote (see canRate on the Dossier page) — admins see RatingAverageChart only. */
export function CommitteeRatingPanel({
  studentId,
  cycleId,
  ratings,
  myUserId,
  onRated,
}: {
  studentId: string;
  cycleId: string;
  ratings: CommitteeRatingRow[];
  myUserId: string | null;
  onRated: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const mine = ratings.find((r) => r.rated_by === myUserId);

  async function handleRate(score: number) {
    setSaving(true);
    try {
      await upsertCommitteeRating({ studentId, cycleId, score });
      onRated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save rating");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          disabled={saving}
          aria-pressed={mine?.score === score}
          onClick={() => handleRate(score)}
          className={cn(
            "flex size-11 items-center justify-center rounded-full border-2 text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
            mine?.score === score
              ? cn(SCORE_STYLES[score].selectedBg, "text-white")
              : cn(SCORE_STYLES[score].border, "text-muted-foreground hover:text-foreground"),
          )}
        >
          {score}
        </button>
      ))}
    </div>
  );
}
