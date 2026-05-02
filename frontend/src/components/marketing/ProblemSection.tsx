import { Icon } from "../ui/Icons";

const PROBLEMS = [
  {
    title: "Firewalls drift the moment a human touches them",
    body:
      "Every change ticket, every emergency rollback, every \"temporarily open it for QA\" — the rule list grows, ownership erodes, and nobody can confidently answer \"is port 22 open to the internet anywhere?\".",
    icon: <Icon.Wall className="h-5 w-5" />,
  },
  {
    title: "Compliance audits demand evidence, not opinions",
    body:
      "SOC 2, ISO 27001, PCI-DSS, and HIPAA all want to see proof that ingress to sensitive ports is restricted, that SNMP isn't using default communities, and that egress is filtered. Screenshots of a console don't survive scrutiny.",
    icon: <Icon.Shield className="h-5 w-5" />,
  },
  {
    title: "Tooling is split across vendors and teams",
    body:
      "iptables on the bastion, Security Groups in three AWS accounts, ACLs on the edge router, and a forgotten JunOS device. Nobody has a single view of \"what does our perimeter look like, today\".",
    icon: <Icon.Server className="h-5 w-5" />,
  },
  {
    title: "Incidents start where posture gaps live",
    body:
      "The 2024 attack surface report still names the same culprits: cleartext management, world-open databases, weak SNMP, missing egress filtering. The fix is well-known. The detection is the bottleneck.",
    icon: <Icon.Alert className="h-5 w-5" />,
  },
];

export function ProblemSection() {
  return (
    <section id="why" className="space-y-6">
      <SectionHeader
        eyebrow="Why this matters"
        title="The posture gap costs more than the breach"
        subtitle="Four practical problems that every infra and security team I've worked with eventually has to solve."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROBLEMS.map((p, i) => (
          <div
            key={p.title}
            className="glass glass-highlight p-5 hover:border-accent/40 transition-colors animate-rise"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center
                              bg-gradient-to-br from-accent/20 to-accent-2/10 text-accent
                              border border-accent/30 shadow-card shrink-0">
                {p.icon}
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-text-primary leading-snug">
                  {p.title}
                </h3>
                <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
                  {p.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionHeader({
  eyebrow, title, subtitle, align = "left",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <header className={align === "center" ? "text-center max-w-2xl mx-auto" : ""}>
      {eyebrow && (
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-accent font-semibold">
          {eyebrow}
        </div>
      )}
      <h2 className="mt-1.5 text-2xl md:text-3xl font-display font-semibold tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className={"mt-2 text-text-secondary " + (align === "center" ? "" : "max-w-2xl")}>
          {subtitle}
        </p>
      )}
    </header>
  );
}
