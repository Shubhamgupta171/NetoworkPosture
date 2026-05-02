import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type SampleEntry } from "@/lib/api";
import { sourceClasses, sourceLabels } from "@/lib/format";
import { Icon } from "../ui/Icons";

const PLACEHOLDER = `127.0.0.1
example.com
10.0.0.0/29`;

export function ScanForm() {
  const qc = useQueryClient();
  const [targets, setTargets] = useState("127.0.0.1");
  const [allowPublic, setAllowPublic] = useState(false);
  const [selectedSamples, setSelectedSamples] = useState<Set<string>>(
    new Set(["iptables-permissive", "aws-sg-wide-open", "cisco-legacy"]),
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const samples = useQuery({ queryKey: ["samples"], queryFn: api.samples });

  const start = useMutation({
    mutationFn: () =>
      api.startScan({
        targets: targets.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean),
        sample_ids: Array.from(selectedSamples),
        allow_public: allowPublic,
      }),
    onSuccess: (s) => {
      setError(null);
      setSuccess(
        `Scan complete · ${s.device_count} device${s.device_count === 1 ? "" : "s"}, ` +
        `${s.pass_count} passing / ${s.fail_count} failing checks.`,
      );
      // Refetch every dashboard view affected by the scan.
      qc.invalidateQueries({ queryKey: ["devices"] });
      qc.invalidateQueries({ queryKey: ["rules"] });
      qc.invalidateQueries({ queryKey: ["results"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      qc.invalidateQueries({ queryKey: ["scans"] });
      qc.invalidateQueries({ queryKey: ["catalog"] });
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
    start.mutate();
  }

  function toggle(id: string) {
    const next = new Set(selectedSamples);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedSamples(next);
  }

  // Group samples by source type for clearer presentation.
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
                         bg-gradient-to-br from-accent to-accent-2 text-bg shadow-glow">
          <Icon.Radar className="h-4 w-4" />
        </span>
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-accent font-semibold">
            Run a scan
          </div>
          <h2 className="text-xl font-display font-semibold leading-tight">
            What would you like to check?
          </h2>
        </div>
      </div>
      <p className="text-sm text-text-secondary mt-1 max-w-2xl">
        Enter websites, server addresses, or IP ranges that you own or are authorised to test.
        Optionally include sample firewall configurations so the report covers more checks.
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5">
        {/* Targets */}
        <div>
          <label className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold">
            Targets
          </label>
          <textarea
            value={targets}
            onChange={(e) => setTargets(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            className="mt-1.5 w-full rounded-xl bg-surface-2/60 border border-border-soft/50
                       text-text-primary text-sm font-mono p-3 leading-relaxed
                       focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40
                       resize-y placeholder:text-text-muted/60 transition"
          />
          <p className="mt-1.5 text-[11px] text-text-muted">
            One per line, comma- or space-separated. Hostnames are resolved automatically.
            Maximum 16 targets per scan.
          </p>

          <label className="mt-3 flex items-start gap-2.5 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={allowPublic}
              onChange={(e) => setAllowPublic(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border-soft accent-accent"
            />
            <span>
              <span className="font-medium text-text-primary">Allow public targets</span>
              <span className="block text-text-muted">
                Off by default. Only enable for networks you own or have explicit permission to test.
              </span>
            </span>
          </label>
        </div>

        {/* Sample fixtures */}
        <div>
          <label className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold">
            Include sample firewall configurations
          </label>
          <p className="text-[11px] text-text-muted mt-1">
            Pre-loaded examples covering iptables, AWS Security Groups, and Cisco IOS — useful to
            see the full benchmark output without uploading your own configs.
          </p>

          <div className="mt-3 space-y-3 max-h-64 overflow-auto pr-1">
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
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(s.id)}
                          className="h-4 w-4 rounded border-border-soft accent-accent"
                        />
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

        {/* Footer row — actions + status */}
        <div className="lg:col-span-2 flex flex-wrap items-center gap-3 pt-2 border-t border-border-soft/40">
          <button
            type="submit"
            disabled={start.isPending || !targets.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                       bg-gradient-to-r from-accent to-accent-2 text-bg font-semibold
                       shadow-glow hover:scale-[1.02] active:scale-[0.99]
                       disabled:opacity-60 disabled:cursor-not-allowed transition-transform"
          >
            {start.isPending ? (
              <>
                <span className="h-3.5 w-3.5 rounded-full border-2 border-bg/40 border-t-bg animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <Icon.Radar className="h-4 w-4" />
                Start scan
              </>
            )}
          </button>

          <span className="text-xs text-text-muted">
            Read-only · runs on the server · typically completes in a few seconds
          </span>

          {error && (
            <span className="badge bg-danger/10 text-danger border-danger/40 ml-auto">
              <Icon.Alert className="h-3 w-3" />
              {error}
            </span>
          )}
          {success && !error && (
            <span className="badge bg-success/10 text-success border-success/40 ml-auto">
              <Icon.Check className="h-3 w-3" />
              {success}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
