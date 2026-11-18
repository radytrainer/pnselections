"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { paperMax, round, subjectMax, type ExamData, type ExamPaper, type ExamSheet } from "@/features/written-exam/scoring";
import { KeyVersions } from "@/components/exams/KeyVersions";
import { parseKeyFile, type KeyRow } from "@/features/written-exam/zipgrade";
import { createPaper, deletePaper, renamePaper, saveKey, saveSubjects } from "@/services/writtenExamService";
import { readSpreadsheet } from "@/components/exams/readSpreadsheet";

type TabProps = { data: ExamData; canEdit: boolean; reload: () => Promise<void> };

export function PapersTab({ data, canEdit, reload }: TabProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createPaper(data.cycle.id, name.trim());
      setName("");
      toast.success("Paper added");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add the paper");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {data.papers.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No papers yet for {data.cycle.name}. Add one for each ZipGrade answer sheet, for example “Math &amp; Logic” and “English”.
        </p>
      )}

      {data.papers.map((p) => (
        <PaperCard
          // Remount after a save so the editors start from the saved values (new subject ids, renamed paper).
          key={`${p.id}|${p.name}|${p.subjects.map((s) => `${s.id}:${s.name}:${s.from_question}-${s.to_question}`).join(",")}|${(p.key_versions ?? []).map((v) => v.version).join(",")}`}
          paper={p} sheets={data.sheets.filter((s) => s.paper_id === p.id)} canEdit={canEdit} reload={reload} />
      ))}

      {canEdit && (
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            id="new-paper-name"
            placeholder="New paper name, e.g. English"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="sm:max-w-xs"
            maxLength={80}
          />
          <Button type="submit" disabled={busy || !name.trim()}>
            <Plus /> Add paper
          </Button>
        </form>
      )}
    </div>
  );
}

type SubjectDraft = { id?: string; name: string; from: string; to: string };

function PaperCard({ paper, sheets, canEdit, reload }: { paper: ExamPaper; sheets: ExamSheet[]; canEdit: boolean; reload: () => Promise<void> }) {
  const sheetCount = sheets.length;
  const fileRef = useRef<HTMLInputElement>(null);
  const [keyPreview, setKeyPreview] = useState<{ rows: KeyRow[]; fileName: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(paper.name);
  const [subjects, setSubjects] = useState<SubjectDraft[]>(
    paper.subjects.map((s) => ({ id: s.id, name: s.name, from: String(s.from_question), to: String(s.to_question) })),
  );
  const [saving, setSaving] = useState(false);

  const qCount = paper.questions.length;
  const max = paperMax(paper);
  const cancelled = paper.questions.filter((q) => q.cancelled).length;
  const subjectsDirty =
    JSON.stringify(subjects) !==
    JSON.stringify(paper.subjects.map((s) => ({ id: s.id, name: s.name, from: String(s.from_question), to: String(s.to_question) })));

  const subjectProblem = (() => {
    const parsed = subjects.map((s) => ({ ...s, f: Number(s.from), t: Number(s.to) }));
    for (const s of parsed) {
      if (!s.name.trim()) return "Every subject needs a name.";
      if (!Number.isInteger(s.f) || !Number.isInteger(s.t) || s.f < 1 || s.t < s.f) return `Check the question range for “${s.name}”.`;
      if (qCount && s.t > qCount) return `“${s.name}” goes past question ${qCount}, the last question in the key.`;
    }
    const sorted = [...parsed].sort((a, b) => a.f - b.f);
    for (let i = 1; i < sorted.length; i++) if (sorted[i].f <= sorted[i - 1].t) return `“${sorted[i - 1].name}” and “${sorted[i].name}” overlap.`;
    return null;
  })();

  async function onKeyFile(file: File) {
    try {
      const { matrix } = await readSpreadsheet(file);
      setKeyPreview({ rows: parseKeyFile(matrix), fileName: file.name });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmKey() {
    if (!keyPreview) return;
    setSaving(true);
    try {
      await saveKey(paper.id, keyPreview.rows);
      toast.success(`Answer key saved: ${keyPreview.rows.length} questions`);
      setKeyPreview(null);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save the key");
    } finally {
      setSaving(false);
    }
  }

  async function saveSubjectList() {
    setSaving(true);
    try {
      await saveSubjects(
        paper.id,
        subjects.map((s) => ({ id: s.id, name: s.name.trim(), fromQuestion: Number(s.from), toQuestion: Number(s.to) })),
      );
      toast.success("Subjects saved");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save subjects");
    } finally {
      setSaving(false);
    }
  }

  async function saveTitle() {
    if (!title.trim() || title.trim() === paper.name) return setTitle(paper.name);
    try {
      await renamePaper(paper.id, title.trim());
      await reload();
    } catch (error) {
      setTitle(paper.name);
      toast.error(error instanceof Error ? error.message : "Failed to rename");
    }
  }

  async function remove() {
    try {
      await deletePaper(paper.id);
      toast.success("Paper deleted");
      setConfirmDelete(false);
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  }

  const previewPoints = keyPreview?.rows.reduce((n, r) => n + r.points, 0) ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {canEdit ? (
            <Input
              id={`paper-name-${paper.id}`}
              aria-label="Paper name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="h-8 max-w-xs border-transparent px-1 text-base font-semibold shadow-none hover:border-input focus-visible:border-input"
            />
          ) : (
            <CardTitle>{paper.name}</CardTitle>
          )}
          <CardDescription>
            {qCount ? `${qCount} questions · out of ${round(max)}${cancelled ? ` (${cancelled} cancelled)` : ""}` : "No answer key yet"} ·{" "}
            {sheetCount} sheet{sheetCount === 1 ? "" : "s"} imported
            {paper.last_import && ` · last import ${new Date(paper.last_import.created_at).toLocaleDateString()}`}
          </CardDescription>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              id={`key-file-${paper.id}`}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onKeyFile(e.target.files[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp /> {qCount ? "Replace answer key" : "Upload answer key"}
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${paper.name}`}>
              <Trash2 />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="mb-2 text-sm font-medium">Subjects</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Each subject is a range of questions on this sheet. Its maximum comes from the key (cancelled questions don&apos;t count).
            {!qCount && " Upload the key or import a ZipGrade file first."}
          </p>
          <div className="space-y-2">
            {subjects.map((s, i) => {
              const live = paper.subjects.find((x) => x.id === s.id);
              return (
                <div key={s.id ?? `new-${i}`} className="flex flex-wrap items-center gap-2">
                  <Input
                    id={`subject-name-${paper.id}-${i}`}
                    aria-label="Subject name"
                    value={s.name}
                    disabled={!canEdit}
                    onChange={(e) => setSubjects((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    className="w-40"
                    placeholder="Subject"
                  />
                  <span className="text-sm text-muted-foreground">questions</span>
                  <Input
                    id={`subject-from-${paper.id}-${i}`}
                    aria-label="First question"
                    type="number"
                    min={1}
                    value={s.from}
                    disabled={!canEdit}
                    onChange={(e) => setSubjects((list) => list.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    id={`subject-to-${paper.id}-${i}`}
                    aria-label="Last question"
                    type="number"
                    min={1}
                    value={s.to}
                    disabled={!canEdit}
                    onChange={(e) => setSubjects((list) => list.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))}
                    className="w-20"
                  />
                  {live && qCount > 0 && <span className="text-xs text-muted-foreground tabular-nums">out of {round(subjectMax(paper, live))}</span>}
                  {canEdit && (
                    <Button variant="ghost" size="icon-sm" onClick={() => setSubjects((list) => list.filter((_, j) => j !== i))} aria-label="Remove subject">
                      <X />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
          {canEdit && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const last = Math.max(0, ...subjects.map((s) => Number(s.to) || 0));
                  setSubjects((list) => [...list, { name: "", from: String(last + 1), to: String(qCount || last + 1) }]);
                }}
              >
                <Plus /> Add subject
              </Button>
              {subjectsDirty && (
                <Button size="sm" onClick={saveSubjectList} disabled={saving || !!subjectProblem}>
                  <Save /> Save subjects
                </Button>
              )}
              {subjectsDirty && subjectProblem && <span className="text-xs text-rose-600">{subjectProblem}</span>}
            </div>
          )}
        </div>
        <KeyVersions paper={paper} sheets={sheets} canEdit={canEdit} reload={reload} />
      </CardContent>

      <Dialog open={!!keyPreview} onOpenChange={(o) => !o && setKeyPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save this answer key?</DialogTitle>
            <DialogDescription>
              {keyPreview?.fileName}: {keyPreview?.rows.length} questions, {round(previewPoints)} points in total.
              {qCount > 0 && " This replaces the current key, including any corrections or cancellations made in the app."}
            </DialogDescription>
          </DialogHeader>
          {keyPreview && sheetCount > 0 && paper.questions.length > 0 && keyPreview.rows.length !== paper.questions.length && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              The current key has {paper.questions.length} questions; this file has {keyPreview.rows.length}. Imported sheets will be
              scored against the new key.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            First questions: {keyPreview?.rows.slice(0, 8).map((r) => `${r.number}=${r.answer}`).join(", ")}…
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyPreview(null)}>
              Cancel
            </Button>
            <Button onClick={confirmKey} disabled={saving}>
              Save key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{paper.name}”?</DialogTitle>
            <DialogDescription>
              This removes its answer key, subjects, pass rules and {sheetCount} imported sheet{sheetCount === 1 ? "" : "s"}. It can&apos;t
              be undone; you&apos;d need to import the ZipGrade file again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove}>
              Delete paper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
