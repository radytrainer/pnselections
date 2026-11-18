"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExamPaper, ExamSheet } from "@/features/written-exam/scoring";
import { parseVersionKeyFile, type VersionKey } from "@/features/written-exam/zipgrade";
import { deleteKeyVersion, saveKeyVersion } from "@/services/writtenExamService";
import { readSpreadsheet } from "@/components/exams/readSpreadsheet";

/**
 * Extra answer keys for shuffled versions of one paper (ZipGrade "Key Version").
 * Sheets marked with a listed version are scored with its key; all others use
 * the main key. Points, topics, cancellations and subjects always come from the
 * main key, through each version's "Main No." mapping.
 */
export function KeyVersions({ paper, sheets, canEdit, reload }: { paper: ExamPaper; sheets: ExamSheet[]; canEdit: boolean; reload: () => Promise<void> }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const versions = paper.key_versions ?? [];
  const [version, setVersion] = useState(() => nextLetter(versions.map((v) => v.version)));
  const [preview, setPreview] = useState<{ key: VersionKey; fileName: string; version: string } | null>(null);
  const [remove, setRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Versions written on the imported sheets, with counts.
  const onSheets = new Map<string, number>();
  for (const s of sheets) {
    const v = s.key_version?.trim().toUpperCase();
    if (v) onSheets.set(v, (onSheets.get(v) ?? 0) + 1);
  }
  const defined = new Set(versions.map((v) => v.version.toUpperCase()));
  // A version with no key of its own is scored on the main key, which is right only if it IS the main version.
  const unkeyed = [...onSheets.entries()].filter(([v]) => !defined.has(v));
  const versionOk = /^[A-Za-z0-9]{1,10}$/.test(version.trim());
  const [expanded, setExpanded] = useState(false);

  if (!paper.questions.length) return null;
  if (!canEdit && !versions.length && !unkeyed.length) return null;
  // Most papers have a single version: keep the section out of the way until it's needed.
  if (!versions.length && !unkeyed.length && !expanded) {
    return (
      <div className="border-t pt-3">
        <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setExpanded(true)}>
          Printed shuffled versions of this paper? Add a key version…
        </button>
      </div>
    );
  }

  async function onFile(file: File) {
    try {
      const { matrix } = await readSpreadsheet(file);
      const key = parseVersionKeyFile(matrix, paper.questions.map((q) => q.number));
      setPreview({ key, fileName: file.name, version: version.trim().toUpperCase() });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setPreview(null);
      setRemove(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const reordered = preview ? preview.key.questionMap.filter((m, i) => m !== i + 1).length : 0;
  const missingMain = preview ? paper.questions.length - preview.key.questionMap.length : 0;

  return (
    <div className="border-t pt-3">
      <p className="mb-1 text-sm font-medium">Key versions</p>
      <p className="mb-3 text-xs text-muted-foreground">
        Only needed if you printed shuffled versions of this paper. Sheets marked with a version below (ZipGrade&apos;s Key Version) are
        scored with that version&apos;s key; all other sheets use the main key. Upload the same key file with an extra{" "}
        <strong>Main No.</strong> column giving the main paper&apos;s question number for each question.
      </p>

      {versions.length > 0 && (
        <ul className="mb-3 divide-y rounded-lg border">
          {versions.map((v) => {
            const moved = v.question_map.filter((m, i) => m !== i + 1).length;
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary">{v.version}</span>
                <span>
                  {v.answers.length} questions{moved ? ` · ${moved} in a different order` : " · same order as the main paper"}
                </span>
                <span className="text-muted-foreground">
                  {onSheets.get(v.version.toUpperCase()) ?? 0} sheet{onSheets.get(v.version.toUpperCase()) === 1 ? "" : "s"}
                </span>
                {canEdit && (
                  <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setRemove(v.version)} aria-label={`Remove version ${v.version}`}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {unkeyed.length > 0 && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          {unkeyed.map(([v, n]) => `${n} sheet${n === 1 ? " is" : "s are"} marked version ${v}`).join(", ")} with no key of {unkeyed.length === 1 ? "its" : "their"}{" "}
          own, so they&apos;re scored with the main key. That&apos;s right for the main version; for any other version, upload its key.
        </p>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            id={`version-file-${paper.id}`}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <label htmlFor={`version-name-${paper.id}`} className="text-sm text-muted-foreground">
            Version
          </label>
          <Input
            id={`version-name-${paper.id}`}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-16 uppercase"
            maxLength={10}
          />
          <Button variant="outline" size="sm" disabled={!versionOk} onClick={() => fileRef.current?.click()}>
            <FileUp /> {defined.has(version.trim().toUpperCase()) ? `Replace key for ${version.trim().toUpperCase()}` : "Upload version key"}
          </Button>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save the key for version {preview?.version}?</DialogTitle>
            <DialogDescription>
              {preview?.fileName}: {preview?.key.answers.length} questions
              {reordered ? `, ${reordered} in a different order from the main paper` : ", in the same order as the main paper"}.
            </DialogDescription>
          </DialogHeader>
          {missingMain > 0 && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              {missingMain} main question{missingMain === 1 ? " isn't" : "s aren't"} on this version, so version {preview?.version} sheets can&apos;t earn
              {missingMain === 1 ? " its" : " their"} points.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            First questions: {preview?.key.answers.slice(0, 6).map((a, i) => `${i + 1}=${a} (main ${preview.key.questionMap[i]})`).join(", ")}…
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                preview &&
                run(() => saveKeyVersion(paper.id, preview.version, preview.key.answers, preview.key.questionMap), `Key for version ${preview.version} saved`)
              }
            >
              Save key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!remove} onOpenChange={(o) => !o && setRemove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove the key for version {remove}?</DialogTitle>
            <DialogDescription>Sheets marked version {remove} will be scored with the main key instead.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemove(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => remove && run(() => deleteKeyVersion(paper.id, remove), `Version ${remove} removed`)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function nextLetter(used: string[]) {
  const taken = new Set(used.map((u) => u.toUpperCase()));
  return "BCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((l) => !taken.has(l)) ?? "";
}
