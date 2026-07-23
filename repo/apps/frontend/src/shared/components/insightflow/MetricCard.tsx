import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  delta?: string;
  icon: LucideIcon;
  tone?: "violet" | "blue" | "green" | "cyan" | "slate";
  footer?: string;
  sparkline?: number[];
};

const toneMap = {
  violet: "from-violet-50 to-white text-violet-600",
  blue: "from-blue-50 to-white text-blue-600",
  green: "from-emerald-50 to-white text-emerald-600",
  cyan: "from-cyan-50 to-white text-cyan-600",
  slate: "from-slate-50 to-white text-slate-600",
};

export function MetricCard({
  title,
  value,
  subtitle,
  delta,
  icon: Icon,
  tone = "violet",
  footer,
  sparkline = [12, 8, 14, 7, 6, 13, 16, 9, 18, 11, 12],
}: MetricCardProps) {
  const max = Math.max(...sparkline);
  const points = sparkline
    .map((n, index) => {
      const x = (index / Math.max(sparkline.length - 1, 1)) * 120;
      const y = 30 - (n / max) * 24;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-gradient-to-br p-5 shadow-sm",
        "transition hover:-translate-y-0.5 hover:shadow-md",
        toneMap[tone],
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="rounded-xl bg-white p-3 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {delta ? (
        <p
          className={cn(
            "mt-3 text-xs font-semibold",
            delta.startsWith("-") ? "text-rose-500" : "text-emerald-500",
          )}
        >
          {delta}
        </p>
      ) : null}

      <svg viewBox="0 0 120 34" className="mt-3 h-8 w-full">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />
      </svg>

      {footer ? <p className="mt-3 text-xs text-slate-400">{footer}</p> : null}
    </div>
  );
}
