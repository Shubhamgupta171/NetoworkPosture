import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Icon } from "../ui/Icons";
import { CardsOnly, MCard, TableOnly } from "../ui/MobileCard";

export function ReportsTable() {
  const scans = useQuery({ queryKey: ["scans"], queryFn: api.scans });
  const [downloading, setDownloading] = useState<string | null>(null);

  async function download(scanId: string, format: "json" | "csv" | "pdf") {
    setDownloading(`${scanId}:${format}`);
    try {
      await api.downloadReport(scanId, format);
    } catch (e) {
      // Surface the error inline — keeps the user in flow.
      alert(`Download failed: ${(e as Error).message}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="glass glass-highlight animate-rise overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border-soft/40">
        <div className="min-w-0">
          <h2 className="text-base font-semibold font-display flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg flex items-center justify-center
                             bg-gradient-to-br from-accent-2 to-accent-3 text-bg shadow-card shrink-0">
              <Icon.Activity className="h-4 w-4" />
            </span>
            <span className="truncate">Scan reports</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Every scan you've run is here. Download for tickets, audits, or your CI gate.
          </p>
        </div>
        <span className="chip-accent shrink-0">{scans.data?.length ?? 0} scans</span>
      </header>

      <TableOnly>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Started</th>
              <th>Scan ID</th>
              <th>Devices</th>
              <th>Rulesets</th>
              <th>Outcome</th>
              <th>Duration</th>
              <th className="text-right pr-4">Download</th>
            </tr>
          </thead>
          <tbody>
            {scans.isLoading && (
              <tr><td colSpan={7} className="text-center text-text-muted py-8">Loading…</td></tr>
            )}
            {scans.error && (
              <tr><td colSpan={7} className="text-center text-danger py-8">
                {(scans.error as Error).message}
              </td></tr>
            )}
            {!scans.isLoading && scans.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-text-muted py-10">
                  No scans yet. Run one above to generate your first report.
                </td>
              </tr>
            )}
            {scans.data?.map((s) => {
              const passRate = s.pass_count + s.fail_count
                ? Math.round((s.pass_count / (s.pass_count + s.fail_count)) * 100)
                : 0;
              const ms = new Date(s.finished_at).getTime() - new Date(s.started_at).getTime();
              return (
                <tr key={s.scan_id}>
                  <td className="text-text-secondary">
                    <div>{relativeTime(s.started_at)}</div>
                    <div className="text-[10.5px] text-text-muted">
                      {new Date(s.started_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="font-mono text-[11px] text-accent">
                    {s.scan_id.slice(0, 12)}…
                  </td>
                  <td className="font-mono text-text-primary">{s.device_count}</td>
                  <td className="font-mono text-text-primary">{s.ruleset_count}</td>
                  <td>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge bg-success/10 text-success border-success/40">
                        <Icon.Check className="h-3 w-3" />
                        {s.pass_count} pass
                      </span>
                      <span className="badge bg-danger/10 text-danger border-danger/40">
                        <Icon.X className="h-3 w-3" />
                        {s.fail_count} fail
                      </span>
                      <span
                        className={clsx(
                          "badge",
                          passRate >= 70
                            ? "bg-success/10 text-success border-success/40"
                            : passRate >= 40
                              ? "bg-warning/10 text-warning border-warning/40"
                              : "bg-danger/10 text-danger border-danger/40",
                        )}
                      >
                        {passRate}% pass
                      </span>
                    </div>
                  </td>
                  <td className="text-text-muted text-xs">
                    {ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5 pr-2">
                      <DownloadBtn
                        label="PDF"
                        emphasis
                        loading={downloading === `${s.scan_id}:pdf`}
                        onClick={() => download(s.scan_id, "pdf")}
                      />
                      <DownloadBtn
                        label="CSV"
                        loading={downloading === `${s.scan_id}:csv`}
                        onClick={() => download(s.scan_id, "csv")}
                      />
                      <DownloadBtn
                        label="JSON"
                        loading={downloading === `${s.scan_id}:json`}
                        onClick={() => download(s.scan_id, "json")}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </TableOnly>

      {/* Mobile cards */}
      <CardsOnly>
        {scans.isLoading && <div className="text-center text-text-muted py-6">Loading…</div>}
        {scans.error && (
          <div className="text-center text-danger py-6">{(scans.error as Error).message}</div>
        )}
        {!scans.isLoading && scans.data?.length === 0 && (
          <div className="text-center text-text-muted py-6">
            No scans yet. Run one above to generate your first report.
          </div>
        )}
        {scans.data?.map((s) => {
          const passRate = s.pass_count + s.fail_count
            ? Math.round((s.pass_count / (s.pass_count + s.fail_count)) * 100)
            : 0;
          const ms = new Date(s.finished_at).getTime() - new Date(s.started_at).getTime();
          return (
            <MCard key={s.scan_id}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-sm text-text-primary font-medium">
                    {relativeTime(s.started_at)}
                  </div>
                  <div className="text-[11px] text-text-muted font-mono">
                    {s.scan_id.slice(0, 12)}…
                  </div>
                </div>
                <span className={clsx(
                  "badge",
                  passRate >= 70 ? "bg-success/10 text-success border-success/40"
                    : passRate >= 40 ? "bg-warning/10 text-warning border-warning/40"
                    : "bg-danger/10 text-danger border-danger/40",
                )}>
                  {passRate}% pass
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap text-[11px]">
                <span className="badge bg-success/10 text-success border-success/40">
                  <Icon.Check className="h-3 w-3" />{s.pass_count} pass
                </span>
                <span className="badge bg-danger/10 text-danger border-danger/40">
                  <Icon.X className="h-3 w-3" />{s.fail_count} fail
                </span>
                <span className="chip text-[10px]">
                  {s.device_count}d · {s.ruleset_count}rs
                </span>
                <span className="chip text-[10px]">
                  {ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border-soft/40">
                <DownloadBtn
                  label="PDF"
                  emphasis fullWidth
                  loading={downloading === `${s.scan_id}:pdf`}
                  onClick={() => download(s.scan_id, "pdf")}
                />
                <DownloadBtn
                  label="CSV"
                  fullWidth
                  loading={downloading === `${s.scan_id}:csv`}
                  onClick={() => download(s.scan_id, "csv")}
                />
                <DownloadBtn
                  label="JSON"
                  fullWidth
                  loading={downloading === `${s.scan_id}:json`}
                  onClick={() => download(s.scan_id, "json")}
                />
              </div>
            </MCard>
          );
        })}
      </CardsOnly>
    </section>
  );
}

function DownloadBtn({
  label, onClick, loading, emphasis = false, fullWidth = false,
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
  emphasis?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={`Download ${label} report`}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition",
        "min-h-[40px]",
        fullWidth && "w-full",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        emphasis
          ? "bg-gradient-to-r from-accent to-accent-2 text-bg shadow-glow hover:scale-[1.03]"
          : "border border-border-soft/50 bg-surface-2/40 backdrop-blur " +
            "hover:border-accent/50 hover:bg-accent/10 hover:text-accent",
      )}
    >
      {loading ? (
        <span
          className={clsx(
            "h-3 w-3 rounded-full border-2 animate-spin",
            emphasis ? "border-bg/40 border-t-bg" : "border-text-muted/30 border-t-accent",
          )}
        />
      ) : (
        <Icon.Chevron className="h-3 w-3 rotate-90" />
      )}
      {label}
    </button>
  );
}
