import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Icon } from "../ui/Icons";
import { NetworkOrbit } from "./NetworkOrbit";

export function BrandHero() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary });

  return (
    <section id="overview" className="pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-8 items-center">
        {/* Left: brand + tagline + trust signals */}
        <div className="animate-rise">
          <div className="inline-flex items-center gap-2 chip-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
            Continuous CIS-aligned posture · v0.1
          </div>

          <h1 className="mt-4 text-3xl xs:text-4xl md:text-5xl lg:text-6xl font-display font-bold tracking-tight leading-[1.05]">
            See what your network{" "}
            <span className="bg-gradient-to-r from-accent via-accent-2 to-accent-3 bg-clip-text text-transparent">
              actually exposes
            </span>
            <span className="block text-text-secondary text-xl xs:text-2xl md:text-3xl lg:text-4xl mt-3 font-medium">
              in minutes — not in audits.
            </span>
          </h1>

          <p className="mt-5 text-base md:text-lg text-text-secondary max-w-2xl leading-relaxed">
            Network Posture Scanner discovers reachable hosts, parses firewall configurations across
            <span className="text-text-primary font-medium"> Linux, AWS, and Cisco</span>, and
            evaluates them against the
            <span className="text-text-primary font-medium"> CIS Controls v8</span> benchmark —
            then surfaces the offending rule, the impacted asset, and the remediation in one
            place.
          </p>

          {/* Trust pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            <TrustPill icon={<Icon.Shield className="h-3.5 w-3.5" />} label="CIS Controls v8" />
            <TrustPill icon={<Icon.Activity className="h-3.5 w-3.5" />} label="Read-only · safe" />
            <TrustPill icon={<Icon.Server className="h-3.5 w-3.5" />} label="Self-hosted or AWS" />
            <TrustPill icon={<Icon.Sparkles className="h-3.5 w-3.5" />} label="JSON API + dashboard" />
          </div>

          {/* CTAs */}
          <div className="mt-7 flex flex-col xs:flex-row flex-wrap items-stretch xs:items-center gap-3">
            <a
              href="#live"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                         bg-gradient-to-r from-accent to-accent-2 text-bg font-semibold
                         shadow-glow hover:scale-[1.02] active:scale-[0.99] transition-transform
                         min-h-[48px]"
            >
              <Icon.Radar className="h-4 w-4" />
              See it live
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl
                         border border-border-soft/60 bg-surface-2/40 backdrop-blur
                         text-text-primary hover:border-accent/40 transition-colors
                         min-h-[48px]"
            >
              How it works
              <Icon.Chevron className="h-4 w-4 -rotate-90" />
            </a>

            {summary.data && summary.data.total > 0 && (
              <span className="text-xs text-text-muted hidden md:inline">
                Live demo populated ·{" "}
                <span className="text-success font-medium">{summary.data.passed} passing</span>
                {" / "}
                <span className="text-danger font-medium">{summary.data.failed} failing</span>{" "}
                across {summary.data.total} controls
              </span>
            )}
          </div>
        </div>

        {/* Right: animated network orbit */}
        <div className="relative">
          <div className="absolute inset-0 -z-10 blur-3xl opacity-60"
               style={{ background: "radial-gradient(circle, rgb(var(--accent)/0.25), transparent 70%)" }} />
          <NetworkOrbit />
        </div>
      </div>
    </section>
  );
}

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                     bg-surface-2/60 backdrop-blur border border-border-soft/50
                     text-xs text-text-secondary">
      <span className="text-accent">{icon}</span>
      {label}
    </span>
  );
}
