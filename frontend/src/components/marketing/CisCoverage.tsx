import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import { severityClasses } from "@/lib/format";
import { Icon } from "../ui/Icons";
import { SectionHeader } from "./ProblemSection";

/**
 * Renders all 8 CIS checks the engine ships with — driven by the
 * /cis-results/catalog endpoint so adding a new check on the backend
 * automatically lights up here too.
 */
export function CisCoverage() {
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: api.catalog });
  const results = useQuery({ queryKey: ["results"], queryFn: () => api.results() });

  const passByCheck = (results.data ?? []).reduce<Record<string, number>>((acc, r) => {
    if (r.outcome === "pass") acc[r.check_id] = (acc[r.check_id] ?? 0) + 1;
    return acc;
  }, {});
  const failByCheck = (results.data ?? []).reduce<Record<string, number>>((acc, r) => {
    if (r.outcome === "fail") acc[r.check_id] = (acc[r.check_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <section id="coverage" className="space-y-6">
      <SectionHeader
        eyebrow="CIS Coverage"
        title="Eight checks, mapped to controls auditors already trust"
        subtitle="Each check links back to a CIS Controls v8 or CIS Cisco IOS clause. The dashboard shows the offending rule, banner, or community for every failure — not just a pass/fail tally."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(catalog.data ?? Array.from({ length: 8 }).map(() => null)).map((c, idx) => (
          <div
            key={c?.check_id ?? idx}
            className="glass glass-highlight p-4 animate-rise hover:border-accent/40 transition-colors"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {c ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-accent">{c.check_id}</span>
                  <span className={clsx("badge text-[10px]", severityClasses[c.severity])}>
                    {c.severity}
                  </span>
                </div>
                <h3 className="mt-2 text-[14px] font-semibold leading-snug text-text-primary">
                  {c.title}
                </h3>
                <p className="mt-1.5 text-[11px] text-text-muted leading-relaxed">
                  {c.cis_reference}
                </p>

                {/* Live tally if any results exist */}
                {(passByCheck[c.check_id] || failByCheck[c.check_id]) && (
                  <div className="mt-3 flex items-center gap-2 text-[11px]">
                    {passByCheck[c.check_id] > 0 && (
                      <span className="badge bg-success/10 text-success border-success/40">
                        <Icon.Check className="h-3 w-3" />
                        {passByCheck[c.check_id]} pass
                      </span>
                    )}
                    {failByCheck[c.check_id] > 0 && (
                      <span className="badge bg-danger/10 text-danger border-danger/40">
                        <Icon.X className="h-3 w-3" />
                        {failByCheck[c.check_id]} fail
                      </span>
                    )}
                  </div>
                )}

                <details className="mt-3 group">
                  <summary className="cursor-pointer text-[11px] text-accent/80 hover:text-accent
                                     inline-flex items-center gap-1 list-none">
                    <Icon.Chevron className="h-3 w-3 transition-transform group-open:rotate-180" />
                    Remediation
                  </summary>
                  <p className="mt-1.5 text-[11px] text-text-secondary leading-relaxed">
                    {c.remediation}
                  </p>
                </details>
              </>
            ) : (
              <div className="h-32 rounded-xl bg-surface-2/40 animate-pulse-soft" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
