import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type Outcome } from "@/lib/api";
import { outcomeClasses, severityClasses } from "@/lib/format";
import { Icon } from "./ui/Icons";

const TABS: Array<{ id: "" | Outcome; label: string }> = [
  { id: "", label: "All" },
  { id: "fail", label: "Failures" },
  { id: "pass", label: "Passes" },
  { id: "not_applicable", label: "N/A" },
];

export function CisResults() {
  const [tab, setTab] = useState<"" | Outcome>("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ["results", tab],
    queryFn: () => api.results(tab === "" ? undefined : tab),
  });
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.catalog });

  const grouped = (results.data ?? []).reduce<Record<string, typeof results.data>>(
    (acc, r) => {
      acc[r.check_id] ??= [];
      acc[r.check_id]!.push(r);
      return acc;
    },
    {},
  );

  return (
    <section className="glass glass-highlight animate-rise">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border-soft/40">
        <div>
          <h2 className="text-base font-semibold font-display flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg flex items-center justify-center
                             bg-gradient-to-br from-accent to-accent-2 text-bg shadow-card">
              <Icon.Shield className="h-4 w-4" />
            </span>
            CIS benchmark results
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            8 checks aligned to CIS Controls v8 / CIS Cisco IOS — click a row for evidence and remediation.
          </p>
        </div>
        <div className="flex rounded-xl overflow-hidden border border-border-soft/50 text-xs bg-surface-2/40 backdrop-blur">
          {TABS.map((t) => (
            <button
              key={t.id || "all"}
              onClick={() => setTab(t.id)}
              className={clsx(
                "px-3.5 py-1.5 transition-colors font-medium",
                tab === t.id
                  ? "bg-gradient-to-r from-accent/25 to-accent-2/15 text-accent shadow-[inset_0_-2px_0_rgb(var(--accent)/0.6)]"
                  : "text-text-muted hover:bg-surface-3/40 hover:text-text-primary",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="divide-y divide-border-soft/30">
        {results.isLoading && (
          <div className="text-center text-text-muted py-10">Loading…</div>
        )}
        {!results.isLoading && Object.keys(grouped).length === 0 && (
          <div className="text-center text-text-muted py-12">No results in this view.</div>
        )}

        {Object.entries(grouped).map(([checkId, items]) => {
          if (!items || items.length === 0) return null;
          const meta = catalog.data?.find((c) => c.check_id === checkId);
          const failures = items.filter((i) => i.outcome === "fail").length;
          const passes = items.filter((i) => i.outcome === "pass").length;
          const isOpen = expanded === checkId;
          const sev = items[0]!.severity;

          return (
            <div key={checkId} className="group">
              <button
                onClick={() => setExpanded(isOpen ? null : checkId)}
                className="w-full text-left px-5 py-4 transition-colors hover:bg-surface-3/40"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={clsx("badge", severityClasses[sev])}>
                    <span className="sev-dot" style={{ color: `rgb(var(--${sevToken(sev)}))` }} />
                    {sev}
                  </span>
                  <span className="font-mono text-xs text-accent">{checkId}</span>
                  <span className="font-medium text-text-primary text-[15px]">
                    {items[0]!.title}
                  </span>

                  <span className="ml-auto flex items-center gap-1.5 flex-wrap text-[11px]">
                    {passes > 0 && (
                      <span className="badge bg-success/10 text-success border-success/40">
                        <Icon.Check className="h-3 w-3" />
                        {passes} pass
                      </span>
                    )}
                    {failures > 0 && (
                      <span className="badge bg-danger/10 text-danger border-danger/40">
                        <Icon.X className="h-3 w-3" />
                        {failures} fail
                      </span>
                    )}
                    <Icon.Chevron className={clsx(
                      "h-4 w-4 text-text-muted transition-transform",
                      isOpen && "rotate-180",
                    )} />
                  </span>
                </div>

                {meta && (
                  <div className="mt-1.5 ml-1 text-[11px] text-text-muted">
                    <span className="text-text-secondary">{meta.cis_reference}</span>
                  </div>
                )}
              </button>

              {isOpen && (
                <div className="px-5 pb-5 space-y-2.5 animate-fade-in">
                  {items.map((i) => (
                    <div
                      key={i.target_id}
                      className="rounded-xl border border-border-soft/40 p-3.5 bg-surface-2/40 backdrop-blur"
                    >
                      <div className="flex items-center gap-2 text-xs mb-2 flex-wrap">
                        <span className={clsx("badge", outcomeClasses[i.outcome])}>
                          {i.outcome === "pass" && <Icon.Check className="h-3 w-3" />}
                          {i.outcome === "fail" && <Icon.X className="h-3 w-3" />}
                          {i.outcome.replace("_", " ")}
                        </span>
                        <span className="text-text-muted">
                          {i.target_kind}{" "}
                          <span className="font-mono text-accent">{i.target_id}</span>
                        </span>
                      </div>
                      <ul className="space-y-1 text-xs text-text-primary/95">
                        {i.evidence.map((e, idx) => (
                          <li key={idx} className="font-mono leading-relaxed pl-3 relative">
                            <span className="absolute left-0 top-1.5 h-1 w-1 rounded-full bg-accent" />
                            {e}
                          </li>
                        ))}
                      </ul>
                      {i.remediation && i.outcome === "fail" && (
                        <div className="mt-2.5 text-xs text-text-secondary border-t border-border-soft/40 pt-2.5
                                        flex gap-2">
                          <span className="text-accent shrink-0 font-semibold">Fix:</span>
                          <span>{i.remediation}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function sevToken(s: string): string {
  switch (s) {
    case "critical": return "danger";
    case "high":     return "warning";
    case "medium":   return "warning";
    case "low":      return "accent-3";
    default:         return "accent";
  }
}
