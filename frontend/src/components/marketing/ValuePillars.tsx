import { Card3D } from "../ui/Card3D";
import { Icon } from "../ui/Icons";
import { SectionHeader } from "./ProblemSection";

const PILLARS = [
  {
    title: "Discover",
    summary: "Find every reachable host on the segment you point us at.",
    detail:
      "Lightweight TCP-connect probing, ICMP ping fallback, and ARP-cache enrichment — no kernel privileges, no agents on the targets. Banners are captured for SSH, HTTP, SMB, SNMP, and friends to drive fingerprinting.",
    icon: <Icon.Radar className="h-5 w-5" />,
    accent: "from-accent to-accent-2",
  },
  {
    title: "Parse",
    summary: "Normalise rules across vendors into one shape.",
    detail:
      "Built-in parsers for iptables-save, AWS Security Group JSON, and Cisco IOS configurations — every rule lands in the same data model so the same checks apply everywhere. JunOS, nftables, and pfSense are next.",
    icon: <Icon.Wall className="h-5 w-5" />,
    accent: "from-accent-2 to-accent-3",
  },
  {
    title: "Audit",
    summary: "Run CIS-aligned checks and produce evidence.",
    detail:
      "Eight checks aligned to CIS Controls v8 / CIS Cisco IOS — each result links to the exact rule, port, banner, or community string that triggered the finding, plus the remediation language for tickets.",
    icon: <Icon.Shield className="h-5 w-5" />,
    accent: "from-accent-3 to-accent",
  },
  {
    title: "Report",
    summary: "Searchable dashboard and a clean JSON API.",
    detail:
      "REST endpoints for /devices, /firewall-rules, /cis-results — all behind an X-Api-Key that lives in Secrets Manager. The dashboard sits on top of the same API, so anything you see here, your CI pipeline can see too.",
    icon: <Icon.Activity className="h-5 w-5" />,
    accent: "from-accent to-accent-3",
  },
];

export function ValuePillars() {
  return (
    <section id="what" className="space-y-6">
      <SectionHeader
        eyebrow="What we do"
        title="Four jobs done well, in one tool"
        subtitle="Discover, parse, audit, report — each module is independently testable and replaceable. No vendor lock-in, no closed source decision-making, no opaque scoring."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {PILLARS.map((p, idx) => (
          <Card3D key={p.title} intensity={4} className="rounded-2xl">
            <div
              className="glass glass-highlight p-5 h-full relative overflow-hidden animate-rise"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Number badge */}
              <span className="absolute top-3 right-3 text-[11px] font-mono text-text-muted">
                0{idx + 1}
              </span>

              <div className={`h-11 w-11 rounded-xl flex items-center justify-center
                               bg-gradient-to-br ${p.accent} text-bg shadow-glow`}>
                {p.icon}
              </div>

              <h3 className="mt-4 text-lg font-display font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-text-primary/90 font-medium">{p.summary}</p>
              <p className="mt-2 text-xs text-text-muted leading-relaxed">{p.detail}</p>
            </div>
          </Card3D>
        ))}
      </div>
    </section>
  );
}
