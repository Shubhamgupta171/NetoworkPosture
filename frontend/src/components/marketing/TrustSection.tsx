import { Icon } from "../ui/Icons";
import { SectionHeader } from "./ProblemSection";

const PROMISES = [
  {
    title: "We never change your network",
    body:
      "We only look — no logins attempted, no configurations touched, no exploit probes. Think of us as a careful auditor with a notebook, not a security tester with a toolkit.",
    icon: <Icon.Shield className="h-4 w-4" />,
  },
  {
    title: "You always control what's in scope",
    body:
      "Your team chooses which networks we can examine. We refuse to look at anything outside that boundary — even when invoked by automation. Public-internet scans require an extra confirmation every single time.",
    icon: <Icon.Check className="h-4 w-4" />,
  },
  {
    title: "Your secrets stay secret",
    body:
      "Authentication credentials live in your own secret vault, are never written to logs, and never transmitted in the clear. We can't see your data — and we built it that way on purpose.",
    icon: <Icon.Wall className="h-4 w-4" />,
  },
  {
    title: "Your data never leaves your environment",
    body:
      "The dashboard, the database, and the scanner all run inside your own infrastructure. There is no shared cloud and no vendor mothership. If you turn us off tomorrow, your data is already where it needs to be.",
    icon: <Icon.Server className="h-4 w-4" />,
  },
];

const COMMITMENTS = [
  { label: "Encrypted everywhere", detail: "In transit and at rest" },
  { label: "CIS Controls v8 aligned", detail: "Every check maps to a clause" },
  { label: "SOC 2 evidence ready", detail: "Per-finding audit trail" },
  { label: "ISO 27001 mapping", detail: "A.12, A.13 controls covered" },
  { label: "Point-in-time recovery", detail: "Roll back any bad ingest" },
  { label: "HTTPS-only access", detail: "TLS enforced end-to-end" },
];

export function TrustSection() {
  return (
    <section id="trust" className="space-y-6">
      <SectionHeader
        eyebrow="Built for defensive use"
        title="Designed to be trusted with production access"
        subtitle="A posture tool is itself a piece of attackable software. Here is what that means for you, in practice — no jargon, no asterisks."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        {/* Trust promises — customer-facing language only */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROMISES.map((p, i) => (
            <div key={p.title}
                 className="glass glass-highlight p-5 animate-rise"
                 style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-xl flex items-center justify-center
                                 bg-gradient-to-br from-success/20 to-accent-3/15
                                 text-success border border-success/40 shrink-0">
                  {p.icon}
                </span>
                <div>
                  <h3 className="font-semibold text-text-primary text-[14px]">{p.title}</h3>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">{p.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right panel — compliance commitments, not implementation details */}
        <aside className="glass-bright glass-highlight p-5 animate-rise">
          <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.18em] text-accent">
            <Icon.Shield className="h-3.5 w-3.5" />
            Trust & compliance
          </div>
          <h3 className="mt-1.5 text-lg font-display font-semibold leading-tight">
            Built around the standards your auditors already trust
          </h3>
          <p className="mt-1.5 text-xs text-text-muted">
            We design for the controls your compliance team will be asked about — so the evidence
            from day one is the evidence you can hand to an auditor on day ninety.
          </p>

          <ul className="mt-4 space-y-2">
            {COMMITMENTS.map((c) => (
              <li key={c.label}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                             bg-surface-2/60 border border-border-soft/40">
                <span className="h-7 w-7 rounded-lg flex items-center justify-center
                                 bg-gradient-to-br from-accent to-accent-2 text-bg shrink-0
                                 shadow-card">
                  <Icon.Check className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-text-primary font-medium leading-tight">
                    {c.label}
                  </div>
                  <div className="text-[11px] text-text-muted">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
