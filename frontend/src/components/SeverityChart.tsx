import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { Icon } from "./ui/Icons";

const ORDER: Array<"critical" | "high" | "medium" | "low" | "info"> = [
  "critical", "high", "medium", "low", "info",
];

/**
 * Vibrant 3-stop gradients per severity. The base anchors the bar at the
 * floor in a deep saturated tone, the mid is the headline colour, and the
 * top is a brighter highlight that "lifts" the bar visually. Each bar also
 * gets a drop-shadow in its own colour for a glow effect.
 */
const STOPS: Record<string, { base: string; mid: string; top: string; glow: string }> = {
  critical: {
    base: "rgb(127, 29, 29)",   // deep red
    mid:  "rgb(220, 38, 38)",   // bright red
    top:  "rgb(251, 113, 133)", // rose
    glow: "rgba(244, 63, 94, 0.55)",
  },
  high: {
    base: "rgb(154, 52, 18)",   // deep orange
    mid:  "rgb(234, 88, 12)",   // bright orange
    top:  "rgb(253, 186, 116)", // amber
    glow: "rgba(249, 115, 22, 0.50)",
  },
  medium: {
    base: "rgb(146, 64, 14)",   // amber base
    mid:  "rgb(217, 119, 6)",   // amber
    top:  "rgb(252, 211, 77)",  // yellow
    glow: "rgba(234, 179, 8, 0.45)",
  },
  low: {
    base: "rgb(7, 89, 133)",    // sky base
    mid:  "rgb(14, 165, 233)",  // sky
    top:  "rgb(125, 211, 252)", // light cyan
    glow: "rgba(56, 189, 248, 0.45)",
  },
  info: {
    base: "rgb(30, 58, 138)",   // indigo
    mid:  "rgb(59, 130, 246)",  // blue
    top:  "rgb(147, 197, 253)", // light blue
    glow: "rgba(96, 165, 250, 0.40)",
  },
};

export function SeverityChart() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const data = ORDER.map((sev) => ({
    severity: sev,
    failures: summary.data?.by_severity?.[sev] ?? 0,
  }));
  const total = data.reduce((s, d) => s + d.failures, 0);
  const peak = ORDER.find((sev) => (summary.data?.by_severity?.[sev] ?? 0) > 0);

  return (
    <div className="glass glass-highlight p-5 h-full animate-rise relative overflow-hidden">
      {/* Decorative corner glow */}
      <div
        aria-hidden
        className="absolute -top-16 -right-16 h-44 w-44 rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{
          background: peak
            ? `radial-gradient(circle, ${STOPS[peak].glow}, transparent 70%)`
            : "radial-gradient(circle, rgb(var(--accent) / 0.45), transparent 70%)",
        }}
      />

      <div className="flex items-baseline justify-between mb-4 relative">
        <div>
          <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.18em] text-text-muted">
            <Icon.Activity className="h-3.5 w-3.5 text-accent" />
            Failures by severity
          </div>
          <div className="text-sm text-text-secondary mt-1">
            {total === 0
              ? "No failing checks — nice."
              : <>Triage <span className="text-text-primary font-semibold">{total} finding{total === 1 ? "" : "s"}</span> from the top down.</>}
          </div>
        </div>
        {peak && (
          <span
            className="badge text-[10px] uppercase tracking-wider border"
            style={{
              color: STOPS[peak].top,
              borderColor: STOPS[peak].mid,
              background: `${STOPS[peak].glow}`,
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: STOPS[peak].top }} />
            {peak} priority
          </span>
        )}
      </div>

      <div className="h-48 -ml-3 relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 8, bottom: 0, left: -8 }}>
            <defs>
              {ORDER.map((sev) => {
                const c = STOPS[sev];
                return (
                  <linearGradient key={sev} id={`bar-${sev}`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%"  stopColor={c.top} stopOpacity={1} />
                    <stop offset="40%" stopColor={c.mid} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={c.base} stopOpacity={0.85} />
                  </linearGradient>
                );
              })}
              {ORDER.map((sev) => (
                <filter key={`f-${sev}`} id={`glow-${sev}`} x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              ))}
            </defs>

            <XAxis
              dataKey="severity"
              tick={{ fill: "rgb(var(--text-secondary))", fontSize: 11, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "rgb(var(--text-muted))", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: "rgb(var(--accent) / 0.05)", radius: 8 }}
              contentStyle={{
                background: "rgb(var(--surface-1))",
                border: "1px solid rgb(var(--border-soft) / 0.6)",
                borderRadius: 12,
                color: "rgb(var(--text-primary))",
                fontSize: 12,
                fontWeight: 500,
                boxShadow: "0 16px 48px -16px rgb(var(--shadow) / 0.6)",
                padding: "8px 12px",
              }}
              labelStyle={{
                color: "rgb(var(--text-secondary))",
                textTransform: "uppercase",
                fontSize: 10,
                letterSpacing: "0.14em",
                marginBottom: 4,
              }}
              itemStyle={{ color: "rgb(var(--text-primary))" }}
            />
            <Bar dataKey="failures" radius={[12, 12, 4, 4]} maxBarSize={48}>
              {data.map((d) => (
                <Cell
                  key={d.severity}
                  fill={`url(#bar-${d.severity})`}
                  filter={d.failures > 0 ? `url(#glow-${d.severity})` : undefined}
                  style={{
                    filter: d.failures > 0
                      ? `drop-shadow(0 8px 16px ${STOPS[d.severity].glow})`
                      : "none",
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Compact severity legend below the chart */}
      <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-border-soft/40">
        {ORDER.map((sev) => {
          const count = summary.data?.by_severity?.[sev] ?? 0;
          const c = STOPS[sev];
          return (
            <div
              key={sev}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]"
              style={{
                background: count > 0 ? `${c.glow.replace("0.55", "0.10").replace("0.50", "0.10").replace("0.45", "0.10").replace("0.40", "0.10")}` : "rgb(var(--surface-2) / 0.4)",
                color: count > 0 ? c.top : "rgb(var(--text-muted))",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: count > 0 ? `linear-gradient(135deg, ${c.top}, ${c.mid})` : "rgb(var(--text-muted))" }}
              />
              <span className="capitalize font-medium">{sev}</span>
              <span className="font-mono opacity-80">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
