"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, Download, ExternalLink, Link2, Loader2, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { captionedQr, downloadDataUrl, fileSafe, printQrImage, qrDataUrl, toLocalInput } from "@/lib/qr";
import {
  applicationLinkState,
  applicationUrl,
  createStudentApplication,
  getStudentApplication,
  newApplicationLink,
  updateStudentApplication,
  type StudentApplication,
} from "@/services/applicationService";

/** Loads a student's application (null = no link yet; undefined = loading). */
export function useStudentApplication(studentId: string | null) {
  const [application, setApplication] = useState<StudentApplication | null | undefined>(undefined);
  const reload = useCallback(async () => {
    if (!studentId) return;
    try {
      setApplication(await getStudentApplication(studentId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load the application");
      setApplication(null);
    }
  }, [studentId]);
  useEffect(() => {
    setApplication(undefined);
    reload();
  }, [reload]);
  return { application, setApplication, reload };
}

/**
 * The student's own application link + QR code: create it, open/close it,
 * set an expiry, issue a new link. Read-only (status only) without canManage.
 */
export function ApplicationLinkPanel({
  studentId,
  studentName,
  studentCode,
  application,
  reload,
  canManage,
}: {
  studentId: string;
  studentName: string;
  studentCode: string;
  application: StudentApplication | null | undefined;
  reload: () => Promise<void>;
  canManage: boolean;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const url = application ? applicationUrl(application.token) : "";

  useEffect(() => setExpiry(toLocalInput(application?.expires_at ?? null)), [application?.expires_at]);
  useEffect(() => {
    if (!url) return setQr(null);
    let stale = false;
    qrDataUrl(url)
      .then((d) => !stale && setQr(d))
      .catch(() => !stale && setQr(null));
    return () => {
      stale = true;
    };
  }, [url]);

  async function act(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (application === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (application === null) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
          <Link2 className="size-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">No application link yet</p>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Create a personal link and QR code. The student opens it on their phone to fill the scholarship application form, upload their photo and attach up to 5 documents.
          </p>
        </div>
        {canManage && (
          <Button disabled={busy === "create"} onClick={() => act("create", () => createStudentApplication(studentId), "Application link created")}>
            {busy === "create" ? <Loader2 className="animate-spin" /> : <Link2 />}
            Create link &amp; QR
          </Button>
        )}
      </div>
    );
  }

  const state = applicationLinkState(application);
  const expiryChanged = expiry !== toLocalInput(application.expires_at);
  const attachments = application.files.filter((f) => f.doc_type !== "photo").length;
  const hasPhoto = application.files.some((f) => f.doc_type === "photo");
  const footer = "Scan to fill the application · ស្កេនដើម្បីបំពេញពាក្យស្នើរសុំ";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              state === "open" && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
              state === "closed" && "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-300",
              state === "expired" && "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
            )}
          >
            {state === "open" ? "● Link open" : state === "closed" ? "Link closed" : "Link expired"}
          </Badge>
          {application.submitted_at ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-4" /> Submitted {new Date(application.submitted_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="size-4" /> Not submitted yet
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            · {hasPhoto ? "photo" : "no photo"} · {attachments} file{attachments === 1 ? "" : "s"}
          </span>
        </div>
        {canManage && (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={application.link_open}
              disabled={busy === "open"}
              onCheckedChange={(v) => act("open", () => updateStudentApplication(studentId, { linkOpen: v }), v ? "Link opened" : "Link closed")}
              aria-label="Link open"
            />
            Accept answers
          </label>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        <div className={cn("relative mx-auto size-38 rounded-md border bg-white p-1.5 sm:mx-0", state !== "open" && "opacity-40")}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${studentName}'s application form`} className="size-full" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label="Application link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy link"
              title="Copy link"
              onClick={() =>
                navigator.clipboard.writeText(url).then(
                  () => toast.success("Link copied"),
                  () => toast.error("Couldn't copy — select the link and copy it"),
                )
              }
            >
              <Copy />
            </Button>
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex" title="Open the form">
              <Button variant="outline" size="icon" aria-label="Open the form" tabIndex={-1}>
                <ExternalLink />
              </Button>
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                captionedQr(url, studentName, studentCode, footer)
                  .then((d) => downloadDataUrl(d, `Application_QR_${fileSafe(studentName, studentCode)}.png`))
                  .catch(() => toast.error("Couldn't create the QR image"))
              }
            >
              <Download /> Download QR
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                captionedQr(url, studentName, studentCode, footer)
                  .then((d) => !printQrImage(d, studentName) && toast.error("Allow pop-ups to print the QR code"))
                  .catch(() => toast.error("Couldn't create the QR image"))
              }
            >
              <Printer /> Print QR
            </Button>
            {canManage && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmNew(true)}>
                <RefreshCw /> New link
              </Button>
            )}
          </div>
          {canManage && (
            <div className="space-y-1.5">
              <label htmlFor={`app-expiry-${studentId}`} className="text-xs font-medium text-muted-foreground">
                Closes automatically at
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Input id={`app-expiry-${studentId}`} type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full sm:w-56" />
                {expiryChanged && (
                  <Button
                    size="sm"
                    disabled={busy === "expiry"}
                    onClick={() =>
                      act("expiry", () => updateStudentApplication(studentId, { expiresAt: expiry ? new Date(expiry).toISOString() : null }), expiry ? "Expiry saved" : "Expiry removed")
                    }
                  >
                    {busy === "expiry" && <Loader2 className="animate-spin" />}
                    Save
                  </Button>
                )}
                {application.expires_at && !expiryChanged && (
                  <Button variant="ghost" size="sm" disabled={busy === "expiry"} onClick={() => act("expiry", () => updateStudentApplication(studentId, { expiresAt: null }), "Expiry removed")}>
                    No expiry
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {application.expires_at
                  ? state === "expired"
                    ? `Expired ${new Date(application.expires_at).toLocaleString()}. Set a later time to reopen.`
                    : `The link and QR stop working ${new Date(application.expires_at).toLocaleString()}.`
                  : "No expiry — the link works until you close it."}
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new link?</DialogTitle>
            <DialogDescription>
              The current link and QR code stop working immediately. The student&apos;s answers and files are kept — they continue with the new link.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmNew(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy === "new"}
              onClick={() => act("new", () => newApplicationLink(studentId), "New link created — share the new QR code").then(() => setConfirmNew(false))}
            >
              {busy === "new" && <Loader2 className="animate-spin" />}
              Create new link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
