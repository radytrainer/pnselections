import type { Database } from "@/types/database.types";
import { cn } from "@/lib/utils";

type CommitteeRatingRow = Database["public"]["Tables"]["committee_ratings"]["Row"];

/**
 * Heuristic poor-level suggestion off the vote distribution, per the
 * program's rubric: the dominant (most-voted) score sets the base grade,
 * and a meaningful spillover into the next score down softens it by one
 * notch. A 1/2-dominant vote means the committee doesn't see this candidate
 * as a fit at all, so it's a reject suggestion rather than a poor level.
 */
function suggestOutcome(counts: number[], mode: number): { label: string; isFail: boolean } | null {
  const has = (score: number) => counts[score - 1] > 0;

  if (mode === 5) return { label: has(4) ? "A" : "A+", isFail: false };
  if (mode === 4) return { label: has(3) ? "B+" : "A-", isFail: false };
  if (mode === 3) return { label: has(2) || has(1) ? "B-" : "B", isFail: false };
  return { label: "Suggest failed scholarship", isFail: true };
}

/** How many members voted each score (5 down to 1), highlighting whichever
 * score got the most votes — the selection call is made off that, not an average. */
export function RatingAverageChart({ ratings }: { ratings: CommitteeRatingRow[] }) {
  const count = ratings.length;
  const counts = [1, 2, 3, 4, 5].map((score) => ratings.filter((r) => r.score === score).length);
  const maxCount = Math.max(1, ...counts);
  const topCount = Math.max(...counts);
  const topScore = topCount > 0 ? [5, 4, 3, 2, 1].find((score) => counts[score - 1] === topCount)! : null;
  const suggestion = topScore != null ? suggestOutcome(counts, topScore) : null;

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {count} member{count === 1 ? "" : "s"} voted
        </p>
        {topScore != null && (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-primary text-lg font-bold text-primary-foreground">
            {topScore}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        {[5, 4, 3, 2, 1].map((score) => {
          const n = counts[score - 1];
          const isTop = topCount > 0 && n === topCount;
          return (
            <div key={score} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
                  isTop ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                {score}
              </span>
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className={cn("h-2 rounded-full transition-all", isTop ? "bg-primary" : "bg-primary/40")}
                  style={{ width: `${(n / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-4 shrink-0 text-right text-muted-foreground">{n}</span>
            </div>
          );
        })}
      </div>
      {suggestion && (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs font-medium",
            suggestion.isFail
              ? "border-destructive/30 bg-destructive/5 text-destructive"
              : "border-primary/30 bg-primary/5 text-primary",
          )}
        >
          Suggested{suggestion.isFail ? "" : " Poor Level"}: {suggestion.label}
        </div>
      )}
    </div>
  );
}
