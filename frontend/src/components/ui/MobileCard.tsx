import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * A row that renders as a real ``<table>`` on md+ and as stacked cards below
 * md. Use ``<TableOnly>`` and ``<CardsOnly>`` to wrap each variant.
 *
 * Tables are great for desktop scanning across columns; on phones, horizontal
 * scrolling tables are awful. The card layout puts the most important fields
 * first, with secondary metadata stacked underneath.
 */

export function TableOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("hidden md:block", className)}>{children}</div>;
}

export function CardsOnly({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("md:hidden space-y-3 px-4 pb-4 pt-1", className)}>{children}</div>;
}

export function MCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border-soft/40 bg-surface-2/40 p-4 space-y-3
                    shadow-card hover:border-accent/30 transition-colors">
      {children}
    </div>
  );
}

export function MRow({
  label, children, mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3 text-xs">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold w-20 shrink-0">
        {label}
      </div>
      <div className={clsx("min-w-0 flex-1 text-text-primary", mono && "font-mono text-[12px]")}>
        {children}
      </div>
    </div>
  );
}
