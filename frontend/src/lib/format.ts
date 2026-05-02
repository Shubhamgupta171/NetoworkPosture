import type { Outcome, Severity } from "./api";

export const severityClasses: Record<Severity, string> = {
  info: "bg-accent/10 text-accent border-accent/30",
  low: "bg-accent-3/10 text-accent-3 border-accent-3/40",
  medium: "bg-warning/10 text-warning border-warning/40",
  high: "bg-warning/15 text-warning border-warning/50",
  critical: "bg-danger/15 text-danger border-danger/50",
};

export const outcomeClasses: Record<Outcome, string> = {
  pass: "bg-success/10 text-success border-success/40",
  fail: "bg-danger/10 text-danger border-danger/40",
  not_applicable: "bg-surface-2/60 text-text-muted border-border-soft/40",
};

export const sourceClasses: Record<string, string> = {
  iptables: "bg-accent/15 text-accent border-accent/40",
  "aws-sg": "bg-accent-2/15 text-accent-2 border-accent-2/50",
  "cisco-ios": "bg-accent-3/20 text-accent-3 border-accent-3/50",
};

export const sourceLabels: Record<string, string> = {
  iptables: "iptables",
  "aws-sg": "AWS SG",
  "cisco-ios": "Cisco IOS",
};

export function relativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

export function truncate(s: string | null | undefined, n = 80): string {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
