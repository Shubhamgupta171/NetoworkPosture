import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { BrandHero } from "@/components/marketing/BrandHero";
import { ProblemSection, SectionHeader } from "@/components/marketing/ProblemSection";
import { ValuePillars } from "@/components/marketing/ValuePillars";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { CisCoverage } from "@/components/marketing/CisCoverage";
import { TrustSection } from "@/components/marketing/TrustSection";
import { ScanSection } from "@/components/scan/ScanSection";
import { ReportsTable } from "@/components/reports/ReportsTable";
import { RiskHeroCard } from "@/components/RiskHeroCard";
import { SummaryCards } from "@/components/SummaryCards";
import { SeverityChart } from "@/components/SeverityChart";
import { DevicesTable } from "@/components/DevicesTable";
import { FirewallTable } from "@/components/FirewallTable";
import { CisResults } from "@/components/CisResults";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/ui/Icons";
import { api } from "@/lib/api";

export default function App() {
  const summary = useQuery({ queryKey: ["summary"], queryFn: api.summary });
  const isEmpty = !summary.isLoading && summary.data && summary.data.total === 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 px-4 sm:px-6 max-w-[1400px] mx-auto w-full">
        {/* 1 · OVERVIEW — brand promise */}
        <div className="pt-6 pb-8 md:py-16">
          <BrandHero />
        </div>

        {/* 2 · LIVE — the actual dashboard, against real data */}
        <div id="live" className="py-8 md:py-14 space-y-6">
          <SectionHeader
            eyebrow="Live demo"
            title="The dashboard customers see, against real data"
            subtitle="Everything below is read directly from the backend you control. No mockups, no canned screenshots — refresh and the numbers update."
          />

          {isEmpty ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2">
                  <RiskHeroCard />
                </div>
                <SeverityChart />
              </div>

              <SummaryCards />

              <CisResults />

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <DevicesTable />
                <FirewallTable />
              </div>
            </>
          )}
        </div>

        {/* 3 · SCAN — pick instant or recurring; schedules list always visible */}
        <div id="scan" className="py-8 md:py-14 space-y-6">
          <SectionHeader
            eyebrow="Run a scan"
            title="Choose how you want to check"
            subtitle="An instant scan gives you results in a few seconds. A recurring scan keeps the dashboard fresh on the interval you choose. You can have both running at the same time."
          />
          <ScanSection />
        </div>

        {/* 4 · REPORTS — past scans + downloads */}
        <div id="reports" className="py-8 md:py-14 space-y-6">
          <SectionHeader
            eyebrow="Reports"
            title="Download evidence for tickets and audits"
            subtitle="Every scan is saved here. Download a polished PDF for auditors, a CSV for analysts, or JSON for engineers and CI gates."
          />
          <ReportsTable />
        </div>

        {/* 5 · PRODUCT — value pillars (preceded by the why for narrative) */}
        <div className="py-8 md:py-14">
          <ProblemSection />
        </div>
        <div className="py-8 md:py-14">
          <ValuePillars />
        </div>

        {/* 6 · HOW IT WORKS — pipeline */}
        <div className="py-8 md:py-14">
          <HowItWorks />
        </div>

        {/* 7 · COVERAGE — all 8 CIS controls */}
        <div className="py-8 md:py-14">
          <CisCoverage />
        </div>

        {/* TRUST — defensive design (no nav link, but still on the page) */}
        <div className="py-8 md:py-14">
          <TrustSection />
        </div>

        {/* CTA */}
        <div className="py-12 md:py-20">
          <div className="glass-bright glass-highlight gradient-border p-8 md:p-12 text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 chip-accent">
              <Icon.Sparkles className="h-3.5 w-3.5" />
              Ready when you are
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-display font-semibold tracking-tight">
              Bring your{" "}
              <span className="bg-gradient-to-r from-accent via-accent-2 to-accent-3 bg-clip-text text-transparent">
                first network
              </span>
              .
            </h2>
            <p className="mt-3 text-text-secondary max-w-xl mx-auto">
              Clone the repository, point the scanner at a CIDR you own, and have the first
              compliance evidence in your inbox before the kettle finishes boiling.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <a
                href="#live"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                           bg-gradient-to-r from-accent to-accent-2 text-bg font-semibold
                           shadow-glow hover:scale-[1.02] active:scale-[0.99] transition-transform"
              >
                <Icon.Radar className="h-4 w-4" />
                Explore the live demo
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                           border border-border-soft/60 bg-surface-2/40 backdrop-blur
                           text-text-primary hover:border-accent/40 transition-colors"
              >
                Read the docs
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 text-center text-[11px] text-text-muted border-t border-border-soft/30">
        <span className="bg-gradient-to-r from-accent to-accent-3 bg-clip-text text-transparent font-semibold">
          Network Posture Scanner
        </span>
        {" · "}CIS Controls v8 aligned · built for defensive review only
      </footer>
    </div>
  );
}
