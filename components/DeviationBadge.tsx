import { DeviationStatus } from "@/lib/aviagen";
import { Check, ArrowUp, ArrowDown, Minus, LucideIcon } from "lucide-react";

const config: Record<DeviationStatus, { icon: LucideIcon; color: string; bg: string }> = {
  ok:      { icon: Check,    color: "text-emerald-400", bg: "bg-emerald-900/40" },
  high:    { icon: ArrowUp,  color: "text-red-400",     bg: "bg-red-900/40" },
  low:     { icon: ArrowDown, color: "text-blue-400",   bg: "bg-blue-900/40" },
  unknown: { icon: Minus,    color: "text-gray-500",    bg: "bg-gray-800" },
};

export default function DeviationBadge({ status, size = 12 }: { status: DeviationStatus; size?: number }) {
  const { icon: Icon, color, bg } = config[status];
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${bg}`}>
      <Icon size={size} className={color} />
    </span>
  );
}
