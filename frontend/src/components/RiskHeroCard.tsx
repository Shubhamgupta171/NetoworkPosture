import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { Icon } from "./ui/Icons";

/** Score band tuned so a clean baseline scores ~80 and "everything failing" ~10. */
function bandFor(passRate: number) {
  if (passRate >= 80) return { label: "Strong", tone: "success" as const };
  if (passRate >= 55) return { label: "Watch", tone: "warning" as const };
  return { label: "At risk", tone: "danger" as const };
}

const SIZE = 200;
const RADIUS = 78;
const CIRC = 2 * Math.PI * RADIUS;

/** Bright, high-contrast gradient stops per band — these drive the gauge ring,
 *  the centre score colour, and the surrounding glow halo. */
const BAND_PAINT = {
  success: {
    from:  "rgb(52, 211, 153)",
    via:   "rgb(34, 211, 238)",
    to:    "rgb(125, 211, 252)",
    glow:  "rgba(52, 211, 153, 0.45)",
    text:  "rgb(52, 211, 153)",
  },
  warning: {
    from:  "rgb(252, 211, 77)",
    via:   "rgb(251, 146, 60)",
    to:    "rgb(244, 114, 182)",
    glow:  "rgba(251, 146, 60, 0.45)",
    text:  "rgb(251, 191, 36)",
  },
  danger: {
    from:  "rgb(248, 113, 113)",
    via:   "rgb(244, 63, 94)",
    to:    "rgb(192, 38, 211)",
    glow:  "rgba(244, 63, 94, 0.50)",
    text:  "rgb(248, 113, 113)",
  },
} as const;

export function RiskHeroCard() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const devices = useQuery({ queryKey: ["devices"], queryFn: api.devices });
  const rules   = useQuery({ queryKey: ["rules"], queryFn: () => api.rules() });

  const total    = summary.data ? summary.data.passed + summary.data.failed : 0;
  const passRate = total > 0 ? Math.round((summary.data!.passed / total) * 100) : 0;
  const band     = bandFor(passRate);
  const paint    = BAND_PAINT[band.tone];

  const dashOffset = CIRC * (1 - passRate / 100);

  return (
    <div className="glass-bright glass-highlight gradient-border p-6 md:p-8 animate-rise relative overflow-hidden">
      {/* Soft band-coloured halo behind the gauge */}
      <div
        aria-hidden
        className="absolute -left-10 -top-10 h-72 w-72 rounded-full blur-3xl opacity-60 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${paint.glow}, transparent 70%)` }}
      />

      <div className="flex flex-col md:flex-row gap-8 items-start md:items-center relative">
        {/* Circular gauge */}
        <div className="relative shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="block">
            <defs>
              <linearGradient id="gauge-stroke" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%"   stopColor={paint.from} />
                <stop offset="50%"  stopColor={paint.via} />
                <stop offset="100%" stopColor={paint.to} />
              </linearGradient>
              <radialGradient id="gauge-inner" cx="50%" cy="50%" r="50%">
                <stop offset="0%"  stopColor={paint.glow} />
                <stop offset="70%" stopColor="transparent" />
              </radialGradient>
              <filter id="ring-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Inner radial fill so the centre carries band colour subtly */}
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS - 12} fill="url(#gauge-inner)" />

            {/* Tick marks around the perimeter (60 ticks → one every 6°) */}
            {Array.from({ length: 60 }).map((_, i) => {
              const angle = (i * 6 - 90) * (Math.PI / 180);
              const inner = RADIUS + 12;
              const outer = RADIUS + 18;
              const x1 = SIZE / 2 + inner * Math.cos(angle);
              const y1 = SIZE / 2 + inner * Math.sin(angle);
              const x2 = SIZE / 2 + outer * Math.cos(angle);
              const y2 = SIZE / 2 + outer * Math.sin(angle);
              const lit = i / 60 < passRate / 100;
              return (
                <line
                  key={i}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={lit ? paint.via : "rgb(var(--surface-3))"}
                  strokeOpacity={lit ? 0.85 : 0.25}
                  strokeWidth={i % 5 === 0 ? 1.5 : 1}
                />
              );
            })}

            {/* Background track */}
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
              fill="none"
              stroke="rgb(var(--surface-3) / 0.5)"
              strokeWidth="14"
            />
            {/* Progress arc */}
            <circle
              cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
              fill="none"
              stroke="url(#gauge-stroke)"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              filter="url(#ring-glow)"
              style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(.2,.7,.2,1)" }}
            />

            {/* Centre score */}
            <text
              x={SIZE / 2} y={SIZE / 2 - 4}
              textAnchor="middle"
              dominantBaseline="central"
              className="font-display"
              style={{
                fontSize: 52,
                fontWeight: 700,
                fill: paint.text,
                filter: `drop-shadow(0 0 14px ${paint.glow})`,
              }}
            >
              {passRate}
            </text>
            <text
              x={SIZE / 2} y={SIZE / 2 + 28}
              textAnchor="middle"
              className="fill-text-muted"
              style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", fontWeight: 600 }}
            >
              pass rate
            </text>
          </svg>

          {/* Band label pill below the gauge */}
          <div className="mt-3 flex justify-center">
            <span
              className="badge text-[11px] uppercase tracking-[0.15em] font-semibold border"
              style={{
                color: paint.text,
                borderColor: paint.via,
                background: paint.glow,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full animate-pulse-soft" style={{ background: paint.text }} />
              {band.label}
            </span>
          </div>
        </div>

        {/* Headline + key stats */}
        <div className="flex-1 min-w-0 space-y-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <Icon.Radar className="h-3.5 w-3.5 text-accent" />
              Posture overview
            </div>
            <h1 className="mt-1.5 text-2xl md:text-3xl font-display font-semibold tracking-tight">
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${paint.from}, ${paint.via}, ${paint.to})` }}
              >
                {band.label}
              </span>
              <span className="text-text-secondary">
                {" — "}
                <span style={{ color: paint.text }} className="font-semibold">
                  {summary.data?.failed ?? 0}
                </span>
                {" "}active findings
              </span>
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary max-w-xl">
              Latest scan reviewed {total} CIS-aligned controls across discovered hosts and firewall rulesets.
              {summary.data?.not_applicable
                ? ` ${summary.data.not_applicable} not applicable.`
                : ""}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <HeroStat
              icon={<Icon.Server className="h-4 w-4" />}
              label="Devices"
              value={devices.data?.length ?? 0}
              tone="accent"
            />
            <HeroStat
              icon={<Icon.Wall className="h-4 w-4" />}
              label="Rules"
              value={rules.data?.length ?? 0}
              tone="accent2"
            />
            <HeroStat
              icon={<Icon.Check className="h-4 w-4" />}
              label="Passed"
              value={summary.data?.passed ?? 0}
              tone="success"
            />
            <HeroStat
              icon={<Icon.Alert className="h-4 w-4" />}
              label="Failed"
              value={summary.data?.failed ?? 0}
              tone="danger"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroStat({
  icon, label, value, tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "accent" | "accent2" | "success" | "danger";
}) {
  const toneClasses: Record<string, { wrapper: string; halo: string }> = {
    accent:  {
      wrapper: "from-accent/20 to-accent/5 text-accent border-accent/30",
      halo: "shadow-[0_0_30px_-12px_rgb(var(--accent)/0.6)]",
    },
    accent2: {
      wrapper: "from-accent-2/20 to-accent-2/5 text-accent-2 border-accent-2/30",
      halo: "shadow-[0_0_30px_-12px_rgb(var(--accent-2)/0.6)]",
    },
    success: {
      wrapper: "from-success/20 to-success/5 text-success border-success/30",
      halo: "shadow-[0_0_30px_-12px_rgb(var(--success)/0.6)]",
    },
    danger:  {
      wrapper: "from-danger/20 to-danger/5 text-danger border-danger/40",
      halo: "shadow-[0_0_30px_-12px_rgb(var(--danger)/0.6)]",
    },
  };
  const t = toneClasses[tone];
  return (
    <div className={clsx(
      "rounded-xl px-3 py-2.5 bg-gradient-to-br border",
      t.wrapper, t.halo,
    )}>
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] opacity-90">
        {icon}{label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums font-display text-text-primary">
        <AnimatedNumber value={value} />
      </div>
    </div>
  );
}
