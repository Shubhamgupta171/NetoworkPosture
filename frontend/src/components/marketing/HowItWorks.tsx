import { Icon } from "../ui/Icons";
import { SectionHeader } from "./ProblemSection";

interface Step {
  n: string;
  title: string;
  oneLine: string;
  body: string;
  youDo: string;
  weDo: string;
  result: { tone: "success" | "info" | "danger"; label: string }[];
  icon: React.ReactNode;
  accent: string;
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Look around",
    oneLine: "We map the network you tell us to look at.",
    body:
      "Tell us which network or list of devices to check. We quietly look around — no logins, no changes, nothing intrusive — and make a list of what's actually reachable and what each device is sharing.",
    youDo: "Pick a network",
    weDo: "Quiet, read-only scan",
    result: [
      { tone: "info",    label: "14 devices found" },
      { tone: "info",    label: "9 services identified" },
      { tone: "danger",  label: "1 publicly exposed" },
    ],
    icon: <Icon.Radar className="h-5 w-5" />,
    accent: "from-accent to-accent-2",
  },
  {
    n: "02",
    title: "Send it home, securely",
    oneLine: "Findings travel encrypted to your private dashboard.",
    body:
      "Whatever we discovered is delivered to a dashboard that only your team can open. The data lives in your environment — your AWS account or your own server — never on someone else's cloud.",
    youDo: "Nothing — automatic",
    weDo: "Encrypt & deliver privately",
    result: [
      { tone: "success", label: "Encrypted in transit" },
      { tone: "success", label: "Stored only in your account" },
      { tone: "info",    label: "Visible in seconds" },
    ],
    icon: <Icon.Activity className="h-5 w-5" />,
    accent: "from-accent-2 to-accent-3",
  },
  {
    n: "03",
    title: "Show what's wrong, in plain English",
    oneLine: "Every issue comes with the fix and the evidence auditors want.",
    body:
      "We compare your setup against well-known security best practices used by auditors worldwide (the CIS benchmark). For each issue, you see exactly what's wrong, on which device, and what to do about it — ready for tickets, change requests, or your next compliance review.",
    youDo: "Open the dashboard",
    weDo: "Compare against CIS standards",
    result: [
      { tone: "danger",  label: "11 findings to triage" },
      { tone: "success", label: "With evidence + fix steps" },
      { tone: "info",    label: "Audit-ready exports" },
    ],
    icon: <Icon.Shield className="h-5 w-5" />,
    accent: "from-accent-3 to-accent",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="space-y-6">
      <SectionHeader
        eyebrow="How it works"
        title="Three simple steps — no security PhD required"
        subtitle="You point us at a network. We quietly check it. You get a clear list of what's wrong, with exactly what to fix. That's the whole product."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
        {/* Connector line — drawn behind the cards on md+ */}
        <div className="hidden md:block absolute top-[40px] left-[12%] right-[12%] h-0.5
                        bg-gradient-to-r from-accent/0 via-accent/50 to-accent-3/0
                        pointer-events-none" />
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className="glass glass-highlight p-5 animate-rise relative"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center
                               bg-gradient-to-br ${s.accent} text-bg shadow-glow`}>
                {s.icon}
              </div>
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-text-muted font-mono">
                  Step {s.n}
                </div>
                <h3 className="text-lg font-display font-semibold leading-tight">{s.title}</h3>
              </div>
            </div>

            <p className="mt-3 text-[14px] text-text-primary font-medium leading-snug">
              {s.oneLine}
            </p>
            <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{s.body}</p>

            {/* You do / We do */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border-soft/40 bg-surface-2/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">You</div>
                <div className="text-xs text-text-primary mt-0.5">{s.youDo}</div>
              </div>
              <div className="rounded-xl border border-border-soft/40 bg-surface-2/40 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">We</div>
                <div className="text-xs text-text-primary mt-0.5">{s.weDo}</div>
              </div>
            </div>

            {/* Plain-English example outputs */}
            <div className="mt-3 rounded-xl border border-border-soft/40 bg-surface-2/30 p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted mb-1.5">
                What you'll see
              </div>
              <ul className="space-y-1.5">
                {s.result.map((r, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-xs">
                    <ResultIcon tone={r.tone} />
                    <span className="text-text-primary">{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultIcon({ tone }: { tone: "success" | "info" | "danger" }) {
  if (tone === "success") {
    return (
      <span className="h-4 w-4 rounded-full bg-success/15 text-success border border-success/40
                       inline-flex items-center justify-center shrink-0">
        <Icon.Check className="h-2.5 w-2.5" />
      </span>
    );
  }
  if (tone === "danger") {
    return (
      <span className="h-4 w-4 rounded-full bg-danger/15 text-danger border border-danger/40
                       inline-flex items-center justify-center shrink-0">
        <Icon.Alert className="h-2.5 w-2.5" />
      </span>
    );
  }
  return (
    <span className="h-4 w-4 rounded-full bg-accent/15 text-accent border border-accent/40
                     inline-flex items-center justify-center shrink-0">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
    </span>
  );
}
