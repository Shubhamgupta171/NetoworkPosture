import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import { Icon } from "../ui/Icons";
import { CardsOnly, MCard, MRow, TableOnly } from "../ui/MobileCard";
import { SCHEDULE_PRESETS } from "./ScheduleForm";

/**
 * Read-only list of every schedule, with quick pause / delete actions.
 * Always rendered in the Scan section so users can see what's running even
 * when the "Instant scan" tab is active.
 */
export function SchedulesList() {
  const qc = useQueryClient();
  const schedules = useQuery({
    queryKey: ["schedules"],
    queryFn: api.schedules,
    refetchInterval: 30_000,
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateSchedule(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });

  return (
    <section className="glass glass-highlight animate-rise overflow-hidden">
      <header className="px-5 py-4 border-b border-border-soft/40 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="h-7 w-7 rounded-lg flex items-center justify-center
                           bg-gradient-to-br from-accent-3 to-accent text-bg shadow-card">
            <Icon.Activity className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold font-display">Active schedules</h2>
            <p className="text-xs text-text-muted">
              All recurring scans currently configured. Pause to skip the next run, delete to remove for good.
            </p>
          </div>
        </div>
        <span className="chip-accent">{schedules.data?.length ?? 0} active</span>
      </header>

      <TableOnly>
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Targets</th>
              <th>Frequency</th>
              <th>Last run</th>
              <th>Next run</th>
              <th>Status</th>
              <th className="text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.isLoading && (
              <tr><td colSpan={7} className="text-center text-text-muted py-6">Loading…</td></tr>
            )}
            {!schedules.isLoading && schedules.data?.length === 0 && (
              <tr><td colSpan={7} className="text-center text-text-muted py-8">
                No schedules yet. Switch to <span className="text-accent font-medium">Recurring scan</span> above to set one up.
              </td></tr>
            )}
            {schedules.data?.map((s) => (
              <tr key={s.schedule_id}>
                <td>
                  <div className="font-medium text-text-primary">{s.name}</div>
                  <div className="text-[11px] text-text-muted">
                    {s.sample_ids.length
                      ? `+ ${s.sample_ids.length} sample${s.sample_ids.length === 1 ? "" : "s"}`
                      : "no samples"}
                  </div>
                </td>
                <td className="text-xs text-text-secondary">
                  <div className="font-mono text-accent">{s.targets[0]}</div>
                  {s.targets.length > 1 && (
                    <div className="text-[11px] text-text-muted">
                      +{s.targets.length - 1} more
                    </div>
                  )}
                </td>
                <td className="text-xs text-text-secondary">{intervalLabel(s.interval_minutes)}</td>
                <td className="text-xs text-text-muted">
                  {s.last_run_at ? relativeTime(s.last_run_at) : "—"}
                </td>
                <td className="text-xs text-text-secondary">{relativeTime(s.next_run_at)}</td>
                <td>
                  <StatusBadge status={s.last_status} enabled={s.enabled} />
                </td>
                <td>
                  <div className="flex items-center justify-end gap-1.5 pr-2">
                    <button
                      type="button"
                      onClick={() => toggle.mutate({ id: s.schedule_id, enabled: !s.enabled })}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium
                                 border border-border-soft/50 bg-surface-2/40
                                 hover:border-accent/50 hover:text-accent transition"
                    >
                      {s.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete schedule "${s.name}"?`)) remove.mutate(s.schedule_id);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium
                                 border border-border-soft/50 bg-surface-2/40
                                 hover:border-danger/50 hover:text-danger transition"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </TableOnly>

      {/* Mobile cards */}
      <CardsOnly>
        {schedules.isLoading && <div className="text-center text-text-muted py-6">Loading…</div>}
        {!schedules.isLoading && schedules.data?.length === 0 && (
          <div className="text-center text-text-muted py-6">
            No schedules yet. Switch to <span className="text-accent font-medium">Recurring scan</span> above to set one up.
          </div>
        )}
        {schedules.data?.map((s) => (
          <MCard key={s.schedule_id}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-semibold text-text-primary truncate">{s.name}</div>
              <StatusBadge status={s.last_status} enabled={s.enabled} />
            </div>
            <MRow label="Targets" mono>
              <span className="text-accent">{s.targets[0]}</span>
              {s.targets.length > 1 && (
                <span className="ml-1 text-text-muted">+{s.targets.length - 1} more</span>
              )}
            </MRow>
            <MRow label="Every">{intervalLabel(s.interval_minutes)}</MRow>
            <MRow label="Last">{s.last_run_at ? relativeTime(s.last_run_at) : "—"}</MRow>
            <MRow label="Next">{relativeTime(s.next_run_at)}</MRow>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-soft/40">
              <button
                type="button"
                onClick={() => toggle.mutate({ id: s.schedule_id, enabled: !s.enabled })}
                className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium
                           border border-border-soft/50 bg-surface-2/40
                           hover:border-accent/50 hover:text-accent transition"
              >
                {s.enabled ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete schedule "${s.name}"?`)) remove.mutate(s.schedule_id);
                }}
                className="min-h-[40px] px-3 py-2 rounded-lg text-xs font-medium
                           border border-border-soft/50 bg-surface-2/40
                           hover:border-danger/50 hover:text-danger transition"
              >
                Delete
              </button>
            </div>
          </MCard>
        ))}
      </CardsOnly>
    </section>
  );
}

function intervalLabel(minutes: number): string {
  const preset = SCHEDULE_PRESETS.find((p) => p.minutes === minutes);
  if (preset) return preset.label;
  if (minutes < 60) return `Every ${minutes} min`;
  if (minutes < 1440) return `Every ${Math.round(minutes / 60)} h`;
  if (minutes < 10080) return `Every ${Math.round(minutes / 1440)} day(s)`;
  return `Every ${Math.round(minutes / 10080)} week(s)`;
}

function StatusBadge({ status, enabled }: { status: string | null; enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="badge bg-surface-2/60 text-text-muted border-border-soft/40">
        Paused
      </span>
    );
  }
  if (!status) {
    return (
      <span className="badge bg-accent/10 text-accent border-accent/40">
        Pending first run
      </span>
    );
  }
  if (status === "ok") {
    return (
      <span className="badge bg-success/10 text-success border-success/40">
        <Icon.Check className="h-3 w-3" /> Healthy
      </span>
    );
  }
  return (
    <span className="badge bg-danger/10 text-danger border-danger/40" title={status}>
      <Icon.Alert className="h-3 w-3" /> Error
    </span>
  );
}
