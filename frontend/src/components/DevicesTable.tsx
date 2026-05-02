import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { relativeTime, truncate } from "@/lib/format";
import { Icon } from "./ui/Icons";
import { CardsOnly, MCard, MRow, TableOnly } from "./ui/MobileCard";

export function DevicesTable() {
  const { data, isLoading, error } = useQuery({ queryKey: ["devices"], queryFn: api.devices });

  return (
    <section className="glass glass-highlight animate-rise overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-border-soft/40">
        <div className="min-w-0">
          <h2 className="text-base font-semibold font-display flex items-center gap-2">
            <span className="h-7 w-7 rounded-lg flex items-center justify-center
                             bg-gradient-to-br from-accent-2 to-accent-3 text-bg shadow-card shrink-0">
              <Icon.Server className="h-4 w-4" />
            </span>
            <span className="truncate">Discovered devices</span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Hosts reachable from the scanner with their open services and banners.
          </p>
        </div>
        <span className="chip-accent shrink-0">{data?.length ?? 0} hosts</span>
      </header>

      {/* Desktop / tablet: real table */}
      <TableOnly>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>IP</th>
                <th>Hostname</th>
                <th>MAC</th>
                <th>Open ports & services</th>
                <th>Method</th>
                <th>Discovered</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center text-text-muted py-8">Loading…</td></tr>
              )}
              {error && (
                <tr><td colSpan={6} className="text-center text-danger py-8">{(error as Error).message}</td></tr>
              )}
              {!isLoading && data?.length === 0 && (
                <tr><td colSpan={6} className="text-center text-text-muted py-10">
                  No devices yet. Run the scanner to populate this view.
                </td></tr>
              )}
              {data?.map((d) => (
                <tr key={d.ip}>
                  <td className="font-mono text-accent text-[13px] font-medium">{d.ip}</td>
                  <td className="text-text-secondary">{d.hostname ?? "—"}</td>
                  <td className="font-mono text-xs text-text-muted">{d.mac ?? "—"}</td>
                  <td>
                    {d.open_ports.length === 0 ? (
                      <span className="text-text-muted">none</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {d.open_ports.map((p) => (
                          <span key={`${p.port}/${p.protocol}`}
                                className="chip border border-accent-2/30 bg-surface-2/40"
                                title={p.service?.banner ?? ""}>
                            <span className="text-accent">{p.port}</span>
                            <span className="text-text-muted">/{p.protocol}</span>
                            {p.service?.name && (
                              <span className="ml-1 text-accent-3">{p.service.name}</span>
                            )}
                            {p.service?.banner && (
                              <span className="ml-1 text-text-muted italic">
                                {truncate(p.service.banner, 26)}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td><span className="chip uppercase text-[10px]">{d.discovery_method}</span></td>
                  <td className="text-text-muted text-xs">{relativeTime(d.discovered_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableOnly>

      {/* Mobile: stacked cards */}
      <CardsOnly>
        {isLoading && <div className="text-center text-text-muted py-6">Loading…</div>}
        {error && <div className="text-center text-danger py-6">{(error as Error).message}</div>}
        {!isLoading && data?.length === 0 && (
          <div className="text-center text-text-muted py-6">
            No devices yet. Run the scanner to populate this view.
          </div>
        )}
        {data?.map((d) => (
          <MCard key={d.ip}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-accent text-[15px] font-semibold truncate">{d.ip}</span>
              <span className="chip uppercase text-[10px] shrink-0">{d.discovery_method}</span>
            </div>
            {d.hostname && (
              <div className="text-xs text-text-secondary -mt-2">{d.hostname}</div>
            )}

            <MRow label="Ports">
              {d.open_ports.length === 0 ? (
                <span className="text-text-muted">none</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {d.open_ports.map((p) => (
                    <span key={`${p.port}/${p.protocol}`}
                          className="chip border border-accent-2/30 bg-surface-2/40">
                      <span className="text-accent">{p.port}</span>
                      <span className="text-text-muted">/{p.protocol}</span>
                      {p.service?.name && (
                        <span className="ml-1 text-accent-3">{p.service.name}</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </MRow>
            {d.mac && <MRow label="MAC" mono>{d.mac}</MRow>}
            <MRow label="Found">{relativeTime(d.discovered_at)}</MRow>
          </MCard>
        ))}
      </CardsOnly>
    </section>
  );
}
