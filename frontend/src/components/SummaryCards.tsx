import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import { Card3D } from "./ui/Card3D";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { Icon } from "./ui/Icons";

interface CardProps {
  label: string;
  value: number;
  hint?: string;
  icon: React.ReactNode;
  tone: "primary" | "success" | "warning" | "danger";
  trail?: number[];
}

const TONES = {
  primary: {
    iconBg: "from-accent to-accent-2 text-bg",
    halo: "shadow-[0_0_60px_-20px_rgb(var(--accent)/0.6)]",
    accent: "text-accent",
  },
  success: {
    iconBg: "from-success to-accent-3 text-bg",
    halo: "shadow-[0_0_60px_-20px_rgb(var(--success)/0.6)]",
    accent: "text-success",
  },
  warning: {
    iconBg: "from-warning to-accent text-bg",
    halo: "shadow-[0_0_60px_-20px_rgb(var(--warning)/0.6)]",
    accent: "text-warning",
  },
  danger: {
    iconBg: "from-danger to-accent text-bg",
    halo: "shadow-[0_0_60px_-20px_rgb(var(--danger)/0.6)]",
    accent: "text-danger",
  },
};

function StatCard({ label, value, hint, icon, tone, trail }: CardProps) {
  const t = TONES[tone];
  const max = Math.max(1, ...(trail ?? [1]));

  return (
    <Card3D intensity={5} className={clsx("rounded-2xl", t.halo)}>
      <div className="glass glass-highlight p-5 h-full relative overflow-hidden">
        {/* Decorative corner glow */}
        <div
          aria-hidden
          className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-25 blur-3xl"
          style={{ background: "rgb(var(--accent) / 0.6)" }}
        />

        <div className="flex items-start justify-between relative">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-text-muted">
              {label}
            </div>
            <div className={clsx("mt-1 text-3xl md:text-4xl font-display font-semibold tabular-nums", t.accent)}>
              <AnimatedNumber value={value} />
            </div>
            {hint && (
              <div className="mt-1 text-xs text-text-muted">{hint}</div>
            )}
          </div>
          <div
            className={clsx(
              "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-card",
              t.iconBg,
            )}
          >
            {icon}
          </div>
        </div>

        {/* Tiny sparkline */}
        {trail && trail.length > 1 && (
          <div className="mt-3 flex items-end gap-0.5 h-7">
            {trail.map((v, i) => (
              <div
                key={i}
                className={clsx("flex-1 rounded-sm bg-gradient-to-t from-transparent", t.accent.replace("text-", "to-"))}
                style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: 0.4 + (i / trail.length) * 0.6 }}
              />
            ))}
          </div>
        )}
      </div>
    </Card3D>
  );
}

export function SummaryCards() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const devices = useQuery({ queryKey: ["devices"], queryFn: api.devices });
  const rules = useQuery({ queryKey: ["rules"], queryFn: () => api.rules() });

  const passRate = summary.data
    ? Math.round((summary.data.passed / Math.max(1, summary.data.passed + summary.data.failed)) * 100)
    : 0;
  const passTone = passRate >= 70 ? "success" : passRate >= 40 ? "warning" : "danger";

  // Synthetic sparkline trails — give the cards a sense of life without
  // needing historical scan data we don't have yet.
  const seed = (n: number) => Array.from({ length: 12 }, (_, i) =>
    Math.max(1, Math.round(n * (0.6 + 0.4 * Math.sin(i * 0.9 + n)))),
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        label="Reachable hosts"
        value={devices.data?.length ?? 0}
        hint="Discovered in latest scan"
        icon={<Icon.Server className="h-5 w-5" />}
        tone="primary"
        trail={seed(devices.data?.length ?? 1)}
      />
      <StatCard
        label="Firewall rules"
        value={rules.data?.length ?? 0}
        hint="iptables · AWS SG · Cisco"
        icon={<Icon.Wall className="h-5 w-5" />}
        tone="primary"
        trail={seed(rules.data?.length ?? 1)}
      />
      <StatCard
        label="Findings"
        value={summary.data?.failed ?? 0}
        hint={`${summary.data?.passed ?? 0} controls passing`}
        icon={<Icon.Alert className="h-5 w-5" />}
        tone="danger"
        trail={seed((summary.data?.failed ?? 0) + 1)}
      />
      <StatCard
        label="Pass rate"
        value={passRate}
        hint={`${summary.data?.not_applicable ?? 0} not applicable`}
        icon={<Icon.Check className="h-5 w-5" />}
        tone={passTone}
        trail={seed(passRate || 1)}
      />
    </div>
  );
}
