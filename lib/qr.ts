/** QR code helpers shared by the registration and application link cards. */

/** "2026-04-01T08:00" (local) for <input type="datetime-local"> from an ISO time. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fileSafe(name: string, fallback = "file") {
  return name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 80) || fallback;
}

/** Small QR code as a PNG data URL (for showing on screen). */
export async function qrDataUrl(url: string, width = 360) {
  const QR = await import("qrcode");
  return QR.toDataURL(url, { width, margin: 1, errorCorrectionLevel: "M" });
}

/** QR code with a title, subtitle and footer line under it, as a PNG data URL (for download/print). */
export async function captionedQr(url: string, title: string, subtitle: string, footer: string) {
  const QR = await import("qrcode");
  const qr = await QR.toDataURL(url, { width: 640, margin: 2, errorCorrectionLevel: "M" });
  const img = new Image();
  img.src = qr;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 860;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 40, 30, 640, 640);
  ctx.fillStyle = "#111";
  ctx.textAlign = "center";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText(title.length > 36 ? title.slice(0, 35) + "…" : title, 360, 720);
  ctx.font = "24px sans-serif";
  ctx.fillStyle = "#444";
  ctx.fillText(subtitle, 360, 762);
  ctx.font = "20px sans-serif";
  ctx.fillStyle = "#777";
  ctx.fillText(footer, 360, 810);
  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(data: string, filename: string) {
  const a = document.createElement("a");
  a.href = data;
  a.download = filename;
  a.click();
}

/** Opens a print window with just the QR image. Returns false if pop-ups are blocked. */
export function printQrImage(data: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(
    `<!doctype html><title>QR – ${title.replace(/</g, "&lt;")}</title><style>@page{margin:12mm}body{margin:0;display:flex;justify-content:center;align-items:center;min-height:95vh}img{width:150mm;max-width:100%}</style><img src="${data}" onload="setTimeout(()=>{window.print()},100)">`,
  );
  w.document.close();
  return true;
}
