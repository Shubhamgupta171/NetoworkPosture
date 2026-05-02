import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type SampleEntry } from "@/lib/api";
import { sourceClasses, sourceLabels, relativeTime } from "@/lib/format";
import { Icon } from "../ui/Icons";

interface IntervalPreset {
  minutes: number;
  label: string;
}

const PRESETS: IntervalPreset[] = [
  { minutes: 15,    label: "Every 15 min" },
  { minutes: 60,    label: "Hourly" },
  { minutes: 360,   label: "Every 6 hours" },
  { minutes: 1440,  label: "Daily" },
  { minutes: 10080, label: "Weekly" },
];

/**
 * Form half of the schedule manager. The list lives in ``SchedulesList``
 * so the two can be rendered separately (e.g. when an instant-scan tab is
 * active, we hide this form but keep the list visible).
 */
export function ScheduleForm() {
  const qc = useQueryClient();
  const samples = useQuery({ queryKey: ["samples"], queryFn: api.samples });

  const [name, setName] = useState("Production VPC nightly");
  const [targets, setTargets] = useState("127.0.0.1");
  const [interval, setInterval] = useState(1440);
  const [allowPublic, setAllowPublic] = useState(false);
  const [fireImmediately, setFireImmediately] = useState(false);
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(
    new Set(["aws-sg-wide-open"]),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () =>
      api.createSchedule({
        name,
        targets: targets.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean),
        sample_ids: Array.from(selectedSamples),
        allow_public: allowPublic,
        interval_minutes: interval,
        enabled: true,
        fire_immediately: fireImmediately,
      }),
    onSuccess: (s) => {
      setError(null);
      setSuccess(`Schedule "${s.name}" created — next run ${relativeTime(s.next_run_at)}`);
      qc.invalidateQueries({ queryKey: ["schedules"] });
      setFireImmediately(false);
    },
    onError: (e: Error) => {
      setSuccess(null);
      setError(e.message);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    create.mutate();
  }

  function toggleSample(id: string) {
    const next = new Set(selectedSamples);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSamples(next);
  }

  const grouped = (samples.data ?? []).reduce<Record<string, SampleEntry[]>>(
    (acc, s) => {
      acc[s.source_type] ??= [];
      acc[s.source_type]!.push(s);
      return acc;
    },
    {},
  );

  return (
    <section className="glass-bright glass-highlight gradient-border p-6 animate-rise">
      <div className="flex items-center gap-3 mb-1">
        <span className="h-9 w-9 rounded-xl flex items-center justify-center
                         bg-gradient-to-br from-accent-2 to-accent-3 text-bg shadow-glow">
          <Icon.Activity className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-accent font-semibold">
            Schedule a recurring scan
          </div>
          <h2 className="text-xl font-display font-semibold leading-tight">
            Set it once — we'll keep checking
          </h2>
        </div>
      </div>
      <p className="text-sm text-text-secondary mt-1 max-w-2xl">
        Pick how often you want us to re-check, and the dashboard stays current automatically.
        You can pause or delete a schedule any time.
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <label className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production VPC nightly"
            className="mt-1.5 w-full rounded-xl bg-surface-2/60 border border-border-soft/50
                       text-text-primary text-sm px-3 py-2
                       focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40
                       placeholder:text-text-muted/60 transition"
          />

          <label className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold mt-4 block">
            Targets
          </label>
          <textarea
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder={"127.0.0.1\nexample.com"}
            className="mt-1.5 w-full rounded-xl bg-surface-2/60 border border-border-soft/50
                       text-text-primary text-sm font-mono px-3 py-2 leading-relaxed
                       focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40
                       resize-y placeholder:text-text-muted/60 transition"
          />
          <p className="mt-1 text-[11px] text-text-muted">
            One per line, or comma-separated. Hostnames resolved automatically.
          </p>

          <label className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold mt-4 block">
            How often?
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.minutes}
                type="button"
                onClick={() => setInterval(p.minutes)}
                className={clsx(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition",
                  interval === p.minutes
                    ? "bg-gradient-to-r from-accent to-accent-2 text-bg border-transparent shadow-glow"
                    : "border-border-soft/50 bg-surface-2/40 text-text-secondary hover:border-accent/40",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
            <span>Custom (minutes):</span>
            <input
              type="number"
              min={15}
              max={10080}
              value={interval}
              onChange={(e) => setInterval(Math.max(15, Math.min(10080, Number(e.target.value) || 60)))}
              className="w-24 rounded-lg bg-surface-2/60 border border-border-soft/40
                         text-text-primary text-xs px-2 py-1 font-mono"
            />
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-start gap-2.5 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={allowPublic}
                     onChange={(e) => setAllowPublic(e.target.checked)}
                     className="mt-0.5 h-4 w-4 rounded border-border-soft accent-accent" />
              <span>
                <span className="font-medium text-text-primary">Allow public targets</span>
                <span className="block text-text-muted">
                  Off by default. Only enable for networks you own.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={fireImmediately}
                     onChange={(e) => setFireImmediately(e.target.checked)}
                     className="mt-0.5 h-4 w-4 rounded border-border-soft accent-accent" />
              <span>
                <span className="font-medium text-text-primary">Run first scan immediately</span>
                <span className="block text-text-muted">
                  Otherwise the first run waits one full interval.
                </span>
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold">
            Include sample firewall configurations
          </label>
          <p className="text-[11px] text-text-muted mt-1">
            Same options as the instant-scan form.
          </p>
          <div className="mt-2 max-h-72 overflow-auto pr-1 space-y-3">
            {samples.isLoading && (
              <div className="text-xs text-text-muted">Loading sample catalog…</div>
            )}
            {Object.entries(grouped).map(([sourceType, entries]) => (
              <div key={sourceType}>
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted mb-1.5">
                  {sourceLabels[sourceType] ?? sourceType}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {entries.map((s) => {
                    const checked = selectedSamples.has(s.id);
                    return (
                      <label
                        key={s.id}
                        className={clsx(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition",
                          checked
                            ? "border-accent/60 bg-accent/10"
                            : "border-border-soft/40 bg-surface-2/40 hover:border-accent/30",
                        )}
                      >
                        <input type="checkbox" checked={checked}
                               onChange={() => toggleSample(s.id)}
                               className="h-4 w-4 rounded border-border-soft accent-accent" />
                        <span className={clsx("badge text-[10px]", sourceClasses[s.source_type])}>
                          {sourceLabels[s.source_type] ?? s.source_type}
                        </span>
                        <span className="text-[13px] text-text-primary">{s.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 flex flex-wrap items-center gap-3 pt-2 border-t border-border-soft/40">
          <button type="submit" disabled={create.isPending || !name.trim() || !targets.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                             bg-gradient-to-r from-accent to-accent-2 text-bg font-semibold
                             shadow-glow hover:scale-[1.02] active:scale-[0.99]
                             disabled:opacity-60 disabled:cursor-not-allowed transition-transform">
            {create.isPending ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-bg/40 border-t-bg animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Icon.Sparkles className="h-4 w-4" />
                Create schedule
              </>
            )}
          </button>
          <span className="text-xs text-text-muted">
            Runs in your environment · disable or delete any time
          </span>
          {error && (
            <span className="badge bg-danger/10 text-danger border-danger/40 ml-auto">
              <Icon.Alert className="h-3 w-3" /> {error}
            </span>
          )}
          {success && !error && (
            <span className="badge bg-success/10 text-success border-success/40 ml-auto">
              <Icon.Check className="h-3 w-3" /> {success}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

export { PRESETS as SCHEDULE_PRESETS };
