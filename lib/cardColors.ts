export type CardColor =
  | "slate"
  | "pink"
  | "blue"
  | "violet"
  | "green"
  | "amber"
  | "orange"
  | "rose"
  | "indigo"
  | "cyan"
  | "teal";

/** Tailwind classes can't be built from dynamic strings (JIT scans for literal class names), so every color option is spelled out in full here rather than interpolated. */
export const CARD_COLOR_STYLES: Record<
  CardColor,
  { bg: string; activeBg: string; ring: string; iconBg: string; iconText: string }
> = {
  slate: { bg: "bg-slate-50", activeBg: "bg-slate-100", ring: "ring-slate-300", iconBg: "bg-slate-200", iconText: "text-slate-700" },
  pink: { bg: "bg-pink-50", activeBg: "bg-pink-100", ring: "ring-pink-300", iconBg: "bg-pink-200", iconText: "text-pink-700" },
  blue: { bg: "bg-blue-50", activeBg: "bg-blue-100", ring: "ring-blue-300", iconBg: "bg-blue-200", iconText: "text-blue-700" },
  violet: { bg: "bg-violet-50", activeBg: "bg-violet-100", ring: "ring-violet-300", iconBg: "bg-violet-200", iconText: "text-violet-700" },
  green: { bg: "bg-green-50", activeBg: "bg-green-100", ring: "ring-green-300", iconBg: "bg-green-200", iconText: "text-green-700" },
  amber: { bg: "bg-amber-50", activeBg: "bg-amber-100", ring: "ring-amber-300", iconBg: "bg-amber-200", iconText: "text-amber-700" },
  orange: { bg: "bg-orange-50", activeBg: "bg-orange-100", ring: "ring-orange-300", iconBg: "bg-orange-200", iconText: "text-orange-700" },
  rose: { bg: "bg-rose-50", activeBg: "bg-rose-100", ring: "ring-rose-300", iconBg: "bg-rose-200", iconText: "text-rose-700" },
  indigo: { bg: "bg-indigo-50", activeBg: "bg-indigo-100", ring: "ring-indigo-300", iconBg: "bg-indigo-200", iconText: "text-indigo-700" },
  cyan: { bg: "bg-cyan-50", activeBg: "bg-cyan-100", ring: "ring-cyan-300", iconBg: "bg-cyan-200", iconText: "text-cyan-700" },
  teal: { bg: "bg-teal-50", activeBg: "bg-teal-100", ring: "ring-teal-300", iconBg: "bg-teal-200", iconText: "text-teal-700" },
};
