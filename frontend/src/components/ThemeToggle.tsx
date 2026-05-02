import clsx from "clsx";
import { Icon } from "./ui/Icons";
import { useTheme } from "@/theme/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      className={clsx(
        "relative h-9 w-16 rounded-full border border-border-soft/60",
        "bg-surface-2/50 backdrop-blur-md transition-colors",
        "shadow-[inset_0_1px_0_0_rgb(255_255_255_/_0.06)]",
        "hover:border-accent/40",
      )}
    >
      <span
        className={clsx(
          "absolute top-1 h-7 w-7 rounded-full transition-all duration-300 flex items-center justify-center",
          "bg-gradient-to-br shadow-card",
          isDark
            ? "left-1 from-accent-2 to-accent text-bg shadow-glow"
            : "left-8 from-accent-3 to-accent-2 text-bg shadow-glow",
        )}
      >
        {isDark ? <Icon.Moon className="h-4 w-4" /> : <Icon.Sun className="h-4 w-4" />}
      </span>
      <Icon.Sun
        className={clsx(
          "absolute right-2 top-2.5 h-4 w-4 transition-opacity",
          isDark ? "opacity-50 text-text-muted" : "opacity-0",
        )}
      />
      <Icon.Moon
        className={clsx(
          "absolute left-2 top-2.5 h-4 w-4 transition-opacity",
          isDark ? "opacity-0" : "opacity-50 text-text-muted",
        )}
      />
    </button>
  );
}
