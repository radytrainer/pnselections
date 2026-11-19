"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, Loader2, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  linkState,
  newRegistrationLink,
  registrationUrl,
  updateInformationSession,
  type InformationSession,
} from "@/services/informationSessionService";
import { cn } from "@/lib/utils";
import { captionedQr, downloadDataUrl, fileSafe, printQrImage, qrDataUrl, toLocalInput } from "@/lib/qr";

export function RegistrationLinkCard({ session, onChanged }: { session: InformationSession; onChanged: () => Promise<void> | void }) {
  const url = registrationUrl(session.reg_token);
  const state = linkState(session);
  const [qr, setQr] = useState<string | null>(null);
  const [expiry, setExpiry] = useState(toLocalInput(session.reg_expires_at));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => setExpiry(toLocalInput(session.reg_expires_at)), [session.reg_expires_at]);

  useEffect(() => {
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
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const subtitle = [session.session_date ? new Date(session.session_date + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null, session.venue]
    .filter(Boolean)
    .join(" · ");

  const footer = "Scan to register · ស្កេនដើម្បីចុះឈ្មោះ";

  async function downloadQr() {
    downloadDataUrl(await captionedQr(url, session.name, subtitle, footer), `QR_${fileSafe(session.name, "session")}.png`);
  }

  async function printQr() {
    if (!printQrImage(await captionedQr(url, session.name, subtitle, footer), session.name)) toast.error("Allow pop-ups to print the QR code");
  }

  const expiryChanged = expiry !== toLocalInput(session.reg_expires_at);

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-medium">Registration link</h3>
          <Badge
            variant="outline"
            className={cn(
              state === "open" && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
              state === "closed" && "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-300",
              state === "expired" && "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
            )}
          >
            {state === "open" ? "● Open" : state === "closed" ? "Closed" : "Expired"}
          </Badge>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={session.reg_open}
            disabled={busy === "open"}
            onCheckedChange={(v) => act("open", () => updateInformationSession(session.id, { regOpen: v }), v ? "Registration opened" : "Registration closed")}
            aria-label="Accept registrations"
          />
          Accept registrations
        </label>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
        <div className={cn("relative mx-auto size-38 rounded-md border bg-white p-1.5 sm:mx-0", state !== "open" && "opacity-40")}>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`QR code for ${session.name} registration`} className="size-full" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} aria-label="Registration link" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
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
            <Button variant="outline" size="sm" onClick={() => downloadQr().catch(() => toast.error("Couldn't create the QR image"))}>
              <Download /> Download QR
            </Button>
            <Button variant="outline" size="sm" onClick={() => printQr().catch(() => toast.error("Couldn't create the QR image"))}>
              <Printer /> Print QR
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmNew(true)}>
              <RefreshCw /> New link
            </Button>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`expiry-${session.id}`} className="text-xs font-medium text-muted-foreground">
              Closes automatically at
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input id={`expiry-${session.id}`} type="datetime-local" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full sm:w-56" />
              {expiryChanged && (
                <Button
                  size="sm"
                  disabled={busy === "expiry"}
                  onClick={() =>
                    act("expiry", () => updateInformationSession(session.id, { regExpiresAt: expiry ? new Date(expiry).toISOString() : null }), expiry ? "Expiry saved" : "Expiry removed")
                  }
                >
                  {busy === "expiry" && <Loader2 className="animate-spin" />}
                  Save
                </Button>
              )}
              {session.reg_expires_at && !expiryChanged && (
                <Button variant="ghost" size="sm" disabled={busy === "expiry"} onClick={() => act("expiry", () => updateInformationSession(session.id, { regExpiresAt: null }), "Expiry removed")}>
                  No expiry
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {session.reg_expires_at
                ? state === "expired"
                  ? `Expired ${new Date(session.reg_expires_at).toLocaleString()}. Set a later time to reopen.`
                  : `The link and QR stop working ${new Date(session.reg_expires_at).toLocaleString()}.`
                : "No expiry — the link works until you close it."}
            </p>
          </div>
        </div>
      </div>

      <Dialog open={confirmNew} onOpenChange={setConfirmNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new link?</DialogTitle>
            <DialogDescription>
              The current link and QR code stop working immediately — anyone who scans a printed copy will see &quot;link not found&quot;. Registrations already received are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmNew(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy === "new"}
              onClick={() =>
                act("new", () => newRegistrationLink(session.id), "New link created — share the new QR code").then(() => setConfirmNew(false))
              }
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
