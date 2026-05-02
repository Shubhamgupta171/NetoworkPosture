import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type FirewallRule } from "@/lib/api";
import { sourceClasses, sourceLabels, truncate } from "@/lib/format";
import { Icon } from "./ui/Icons";
import { CardsOnly, MCard, MRow, TableOnly } from "./ui/MobileCard";

const SOURCES: Array<{ id: "" | "iptables" | "aws-sg" | "cisco-ios"; label: string }> = [
  { id: "", label: "All" },
  { id: "iptables", label: "iptables" },
  { id: "aws-sg", label: "AWS SG" },
  { id: "cisco-ios", label: "Cisco" },
];

export function FirewallTable() {
  const [filter, setFilter] = useState<"" | "iptables" | "aws-sg" | "cisco-ios">("");
  const [direction, setDirection] = useState<"" | "ingress" | "egress">("");
  const { data, isLoading } = useQuery({
    queryKey: ["rules", filter],
    queryFn: () => api.rules(filter || undefined),
  });

  const rules: FirewallRule[] = (data ?? []).filter((r) =>
    direction ? r.direction === direction : true
  );

  return (
    <section className="glass glass-highlight animate-rise overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border-soft/40">
        <div>
          <h2 className="text-base font-semibold font-display flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg flex items-center justify-center
                             bg-gradient-to-br from-accent to-accent-3 text-bg shadow-card">
              <Icon.Wall className="h-4 w-4" />
            </span>
            Firewall rules
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Normalised across iptables, AWS Security Groups, and Cisco IOS access lists.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl overflow-hidden border border-border-soft/50 text-xs bg-surface-2/40 backdrop-blur">
            {SOURCES.map((s) => (
              <button
                key={s.id || "all"}
                onClick={() => setFilter(s.id)}
                className={clsx(
                  "px-3 py-1.5 transition-colors font-medium",
                  filter === s.id
                    ? "bg-gradient-to-r from-accent/25 to-accent-2/15 text-accent"
                    : "text-text-muted hover:text-text-primary",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl overflow-hidden border border-border-soft/50 text-xs bg-surface-2/40 backdrop-blur">
            {(["", "ingress", "egress"] as const).map((d) => (
              <button
                key={d || "any"}
                onClick={() => setDirection(d)}
                className={clsx(
                  "px-3 py-1.5 transition-colors uppercase font-medium",
                  direction === d
                    ? "bg-gradient-to-r from-accent-3/25 to-accent/15 text-accent-3"
                    : "text-text-muted hover:text-text-primary",
                )}
              >
                {d || "Both"}
              </button>
            ))}
          </div>
          <span className="chip-accent">{rules.length} rules</span>
        </div>
      </header>

      {/* Desktop / tablet */}
      <TableOnly>
        <div className="overflow-x-auto max-h-[28rem]">
          <table className="table-base">
            <thead className="sticky top-0 z-10">
              <tr>
                <th>Source</th>
                <th>Dir</th>
                <th>Action</th>
                <th>Proto</th>
                <th>From</th>
                <th>To</th>
                <th>Port</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center text-text-muted py-8">Loading…</td></tr>
              )}
              {!isLoading && rules.length === 0 && (
                <tr><td colSpan={8} className="text-center text-text-muted py-10">
                  No rules match this filter.
                </td></tr>
              )}
              {rules.map((r) => (
                <tr key={`${r.ruleset_id}:${r.rule_id}`}>
                  <td>
                    <span className={clsx("badge", sourceClasses[r.source_type] ?? "border-border-soft")}>
                      {sourceLabels[r.source_type] ?? r.source_type}
                    </span>
                    <div className="text-[11px] text-text-muted mt-0.5 font-mono">
                      {truncate(r.ruleset_name, 28)}
                    </div>
                  </td>
                  <td className="uppercase text-[11px] text-text-secondary tracking-wider">{r.direction}</td>
                  <td><ActionPill action={r.action} /></td>
                  <td className="font-mono text-xs text-text-secondary">{r.protocol}</td>
                  <td className="font-mono text-xs text-accent">{truncate(r.source, 28)}</td>
                  <td className="font-mono text-xs text-accent-3">{truncate(r.destination, 28)}</td>
                  <td className="font-mono text-xs">{r.port_range}</td>
                  <td className="text-xs text-text-secondary max-w-xs">
                    {r.description ?? <span className="text-text-muted">—</span>}
                    {r.raw && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-accent/80 hover:text-accent inline-flex items-center gap-1">
                          <Icon.Chevron className="h-3 w-3" />
                          raw
                        </summary>
                        <pre className="mt-1 text-[11px] text-text-muted whitespace-pre-wrap break-all
                                        bg-surface-2/60 p-2 rounded-lg border border-border-soft/30">
                          {r.raw}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableOnly>

      {/* Mobile cards */}
      <CardsOnly>
        {isLoading && <div className="text-center text-text-muted py-6">Loading…</div>}
        {!isLoading && rules.length === 0 && (
          <div className="text-center text-text-muted py-6">No rules match this filter.</div>
        )}
        {rules.map((r) => (
          <MCard key={`${r.ruleset_id}:${r.rule_id}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className={clsx("badge", sourceClasses[r.source_type] ?? "border-border-soft")}>
                {sourceLabels[r.source_type] ?? r.source_type}
              </span>
              <ActionPill action={r.action} />
            </div>
            <div className="text-[11px] text-text-muted font-mono -mt-1.5 truncate">
              {r.ruleset_name}
            </div>

            <MRow label="Dir">
              <span className="uppercase tracking-wider text-text-secondary">{r.direction}</span>
              <span className="ml-2 chip text-[10px] uppercase">{r.protocol}</span>
            </MRow>
            <MRow label="From" mono>
              <span className="text-accent">{r.source}</span>
            </MRow>
            <MRow label="To" mono>
              <span className="text-accent-3">{r.destination}</span>
            </MRow>
            <MRow label="Port" mono>{r.port_range}</MRow>
            {r.description && (
              <MRow label="Notes">
                <span className="text-text-secondary">{r.description}</span>
              </MRow>
            )}
            {r.raw && (
              <details className="mt-1">
                <summary className="cursor-pointer text-[11px] text-accent/80 hover:text-accent inline-flex items-center gap-1">
                  <Icon.Chevron className="h-3 w-3" /> raw
                </summary>
                <pre className="mt-1 text-[11px] text-text-muted whitespace-pre-wrap break-all
                                bg-surface/60 p-2 rounded-lg border border-border-soft/30">
                  {r.raw}
                </pre>
              </details>
            )}
          </MCard>
        ))}
      </CardsOnly>
    </section>
  );
}

function ActionPill({ action }: { action: string }) {
  const cls =
    action === "allow"
      ? "bg-success/10 text-success border-success/40"
      : action === "deny" || action === "default-deny"
        ? "bg-danger/10 text-danger border-danger/40"
        : action === "log"
          ? "bg-warning/10 text-warning border-warning/40"
          : "bg-surface-2/60 text-text-muted border-border-soft";
  return <span className={clsx("badge font-medium", cls)}>{action}</span>;
}
