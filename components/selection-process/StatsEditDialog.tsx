"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type StatsFieldGroup = { title: string; fields: { key: string; label: string }[] };

/** Generic numeric-fields edit dialog shared by every Selection Process card (0027) — each section just supplies its own field groups and current values. */
export function StatsEditDialog({
  title,
  groups,
  values,
  onSave,
}: {
  title: string;
  groups: StatsFieldGroup[];
  // Loose on purpose — callers pass whole DB rows (cycle_id, updated_at,
  // etc. included); only the keys named in `groups` are ever read/written.
  values: Record<string, unknown>;
  onSave: (values: Record<string, number>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    for (const group of groups) {
      for (const field of group.fields) next[field.key] = String(values[field.key] ?? 0);
    }
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      const parsed: Record<string, number> = {};
      for (const key of Object.keys(draft)) parsed[key] = Number(draft[key]) || 0;
      await onSave(parsed);
      toast.success("Saved");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {title}</DialogTitle>
            <DialogDescription>Update the latest manually-tracked numbers for this section.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {groups.map((group, i) => (
              <div key={group.title} className="space-y-2.5">
                {i > 0 && <Separator />}
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.title}</p>
                <div className="grid grid-cols-2 gap-3">
                  {group.fields.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <Label htmlFor={field.key} className="text-xs text-muted-foreground">
                        {field.label}
                      </Label>
                      <Input
                        id={field.key}
                        type="number"
                        min="0"
                        value={draft[field.key] ?? "0"}
                        onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
