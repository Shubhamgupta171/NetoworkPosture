import { Icon } from "./ui/Icons";

export function EmptyState() {
  return (
    <div className="glass-bright glass-highlight gradient-border p-8 animate-rise">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center
                        bg-gradient-to-br from-accent to-accent-2 text-bg shadow-glow shrink-0">
          <Icon.Radar className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.18em] text-text-muted">Getting started</div>
          <h2 className="text-xl font-display font-semibold mt-1">
            <span className="bg-gradient-to-r from-accent to-accent-3 bg-clip-text text-transparent">
              Run your first scan
            </span>
          </h2>
          <p className="mt-1.5 text-sm text-text-secondary max-w-2xl">
            The dashboard is wired to the backend API but no scan has been ingested yet.
            Run the scanner CLI against the bundled sample fixtures to see it in action:
          </p>
          <pre className="mt-3 bg-surface-2/60 border border-border-soft/40 rounded-xl p-4
                          text-xs text-text-primary/95 overflow-x-auto font-mono leading-relaxed">
{`cd scanner && source .venv/bin/activate
NPS_API_KEY=$API_KEY python -m nps_scanner scan \\
  --targets 127.0.0.1 \\
  --firewall-source iptables   --firewall-file ../samples/iptables/permissive.rules \\
  --firewall-source aws-sg     --firewall-file ../samples/aws-sg/wide-open.json \\
  --firewall-source cisco-ios  --firewall-file ../samples/cisco/legacy-edge.cfg`}
          </pre>
        </div>
      </div>
    </div>
  );
}
