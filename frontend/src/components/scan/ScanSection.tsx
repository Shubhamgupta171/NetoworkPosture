import { useState } from "react";
import clsx from "clsx";
import { ScanForm } from "./ScanForm";
import { ScheduleForm } from "./ScheduleForm";
import { SchedulesList } from "./SchedulesList";
import { Icon } from "../ui/Icons";

type Mode = "instant" | "schedule";

interface ModeOption {
  id: Mode;
  label: string;
  hint: string;
  icon: React.ReactNode;
}

const MODES: ModeOption[] = [
  {
    id: "instant",
    label: "Instant scan",
    hint: "Run once, see results in seconds",
    icon: <Icon.Radar className="h-4 w-4" />,
  },
  {
    id: "schedule",
    label: "Recurring scan",
    hint: "Re-check on a schedule",
    icon: <Icon.Activity className="h-4 w-4" />,
  },
];

/**
 * Combines the two scan flows behind a clear mode toggle so customers see
 * "instant scan" and "recurring scan" as equally available options. The
 * existing schedule list is always shown below, regardless of mode.
 */
export function ScanSection() {
  const [mode, setMode] = useState<Mode>("instant");

  return (
    <div className="space-y-6">
      {/* Mode toggle — full-width stacked on mobile, side-by-side from sm+ */}
      <div className="glass p-2 grid grid-cols-1 sm:inline-flex gap-1.5 sm:gap-1 w-full sm:w-auto">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={clsx(
                "flex items-center gap-3 px-4 py-3 sm:py-2.5 rounded-xl transition text-left",
                "min-h-[56px] sm:min-w-[240px]",
                active
                  ? "bg-gradient-to-r from-accent to-accent-2 text-bg shadow-glow"
                  : "text-text-secondary hover:bg-surface-2/60 hover:text-text-primary",
              )}
              aria-pressed={active}
            >
              <span
                className={clsx(
                  "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition",
                  active
                    ? "bg-bg/15 text-bg"
                    : "bg-accent/10 text-accent",
                )}
              >
                {m.icon}
              </span>
              <span className="flex flex-col leading-tight">
                <span className={clsx(
                  "text-[14px] font-semibold font-display",
                  active ? "text-bg" : "text-text-primary",
                )}>
                  {m.label}
                </span>
                <span className={clsx(
                  "text-[11px]",
                  active ? "text-bg/85" : "text-text-muted",
                )}>
                  {m.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected form */}
      {mode === "instant" ? <ScanForm /> : <ScheduleForm />}

      {/* Always-on list of existing schedules — separator helps the user
          understand this is a different concern from the picker above. */}
      <div className="pt-2">
        <SchedulesList />
      </div>
    </div>
  );
}
