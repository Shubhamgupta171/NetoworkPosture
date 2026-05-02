import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, config } from "@/lib/api";
import { ThemeToggle } from "./ThemeToggle";
import { Icon } from "./ui/Icons";

const NAV = [
  { id: "overview",     label: "Overview" },
  { id: "live",         label: "Live" },
  { id: "scan",         label: "Scan" },
  { id: "reports",      label: "Reports" },
  { id: "what",         label: "Product" },
  { id: "how-it-works", label: "How it works" },
  { id: "coverage",     label: "Coverage" },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const health = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 30_000,
  });
  const ok = health.data?.status === "ok";

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Close on resize past the lg breakpoint (so opening on mobile then rotating
  // / resizing doesn't leave a stuck overlay).
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Esc closes the drawer.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 backdrop-blur-xl bg-bg/65 border-b border-border-soft/40">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        {/* Brand mark — animated conic ring around the shield */}
        <a href="#overview" className="flex items-center gap-2.5 group min-w-0"
           onClick={() => setMenuOpen(false)}>
          <BrandMark />
          <div className="min-w-0">
            <div className="text-[14px] sm:text-[15px] font-semibold tracking-tight font-display truncate
                            bg-gradient-to-r from-text-primary via-text-primary to-accent bg-clip-text">
              Network Posture Scanner
            </div>
            <div className="text-[10px] sm:text-[10.5px] text-text-muted -mt-0.5 tracking-wide truncate hidden xs:block">
              CIS-aligned posture, continuously.
            </div>
          </div>
        </a>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0.5 rounded-full
                        bg-surface-2/40 backdrop-blur border border-border-soft/40 p-1">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}
               className="px-3 py-1.5 rounded-full text-xs text-text-secondary
                          hover:text-accent hover:bg-accent/10 transition-colors">
              {n.label}
            </a>
          ))}
        </nav>

        {/* Right side controls */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={clsx(
              "badge hidden md:inline-flex",
              health.isLoading
                ? "bg-surface-2/60 text-text-muted border-border-soft"
                : ok
                  ? "bg-success/10 text-success border-success/40"
                  : "bg-danger/10 text-danger border-danger/40",
            )}
          >
            <span className={clsx(
              "h-1.5 w-1.5 rounded-full",
              ok ? "bg-success animate-pulse-soft" : "bg-danger",
            )}/>
            {health.isLoading ? "checking…" : ok ? "live" : "offline"}
          </span>

          {!config.hasKey && (
            <span className="badge bg-warning/10 text-warning border-warning/40 hidden xl:inline-flex">
              VITE_API_KEY missing
            </span>
          )}

          <ThemeToggle />

          {/* Mobile hamburger — visible below lg */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            className="lg:hidden h-10 w-10 rounded-xl flex items-center justify-center
                       border border-border-soft/50 bg-surface-2/40 backdrop-blur
                       text-text-primary hover:text-accent hover:border-accent/40 transition"
          >
            <Icon.Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/*
        Mobile drawer is portalled to <body> rather than rendered inside this
        <header>. The header has `backdrop-blur`, which (per spec) creates a
        new containing block for fixed-positioned descendants — so a drawer
        rendered here would be clipped to the ~60px-tall header rather than
        filling the viewport. The portal sidesteps that entirely.
      */}
      {createPortal(
        <MobileDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          ok={ok}
          loading={health.isLoading}
        />,
        document.body,
      )}
    </header>
  );
}

/**
 * Layered brand mark:
 * 1. an animated conic-gradient ring rotating slowly
 * 2. an inner gradient tile with the shield glyph
 * 3. a soft outer glow + an "online" pulse dot
 */
function BrandMark() {
  return (
    <div className="relative shrink-0 h-11 w-11 group/brand">
      {/* Outer glow halo */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-2xl blur-md opacity-70
                   bg-gradient-to-br from-accent via-accent-2 to-accent-3
                   group-hover/brand:opacity-100 transition-opacity"
      />

      {/* Rotating conic ring */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-2xl p-[2px] brand-ring"
        style={{
          background:
            "conic-gradient(from var(--brand-angle, 0deg)," +
            " rgb(var(--accent)) 0%," +
            " rgb(var(--accent-3)) 25%," +
            " rgb(var(--accent-2)) 50%," +
            " rgb(var(--accent-3)) 75%," +
            " rgb(var(--accent)) 100%)",
        }}
      >
        <span className="block h-full w-full rounded-[14px] bg-bg" />
      </span>

      {/* Shield tile */}
      <div
        className="absolute inset-[3px] rounded-[12px] flex items-center justify-center
                   bg-gradient-to-br from-accent via-accent-2 to-accent-3
                   shadow-[inset_0_1px_0_rgb(255_255_255_/_0.18)]
                   group-hover/brand:scale-[1.03] transition-transform"
      >
        <Icon.Shield className="h-5 w-5 text-bg drop-shadow" />
      </div>

      {/* Online pulse dot */}
      <span
        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full
                   bg-gradient-to-br from-emerald-300 to-emerald-500
                   ring-2 ring-bg animate-pulse-soft
                   shadow-[0_0_10px_rgba(52,211,153,0.7)]"
        aria-hidden
      />

      <style>{`
        .brand-ring {
          animation: brand-spin 6s linear infinite;
        }
        @keyframes brand-spin {
          to { --brand-angle: 360deg; }
        }
        @media (prefers-reduced-motion: reduce) {
          .brand-ring { animation: none; }
        }
      `}</style>
    </div>
  );
}

function MobileDrawer({
  open, onClose, ok, loading,
}: {
  open: boolean;
  onClose: () => void;
  ok: boolean;
  loading: boolean;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          "lg:hidden fixed inset-0 z-[60] bg-bg/80 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden
      />
      {/* Panel — fully opaque so it can't bleed into content beneath */}
      <aside
        className={clsx(
          "lg:hidden fixed top-0 right-0 z-[70] h-screen w-[88%] max-w-sm",
          "bg-bg border-l border-border-soft/50 shadow-card-lg",
          "flex flex-col transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{ backgroundColor: "rgb(var(--surface-base))" }}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft/40">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-xl flex items-center justify-center
                             bg-gradient-to-br from-accent to-accent-2 text-bg">
              <Icon.Shield className="h-4 w-4" />
            </span>
            <span className="font-display font-semibold text-text-primary">Menu</span>
          </div>
          <button
            type="button" onClick={onClose}
            aria-label="Close menu"
            className="h-9 w-9 rounded-lg flex items-center justify-center
                       border border-border-soft/50 bg-surface-2/40
                       text-text-primary hover:text-danger hover:border-danger/40 transition"
          >
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {/* Status pill inside drawer */}
        <div className="px-5 pt-4">
          <span className={clsx(
            "badge",
            loading
              ? "bg-surface-2/60 text-text-muted border-border-soft"
              : ok
                ? "bg-success/10 text-success border-success/40"
                : "bg-danger/10 text-danger border-danger/40",
          )}>
            <span className={clsx(
              "h-1.5 w-1.5 rounded-full",
              ok ? "bg-success animate-pulse-soft" : "bg-danger",
            )}/>
            backend {loading ? "checking…" : ok ? "live" : "offline"}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-auto">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} onClick={onClose}
                   className="flex items-center justify-between px-4 py-3 rounded-xl
                              text-text-primary hover:bg-accent/10 hover:text-accent
                              transition border border-transparent hover:border-accent/30">
                  <span className="font-medium">{n.label}</span>
                  <Icon.Chevron className="h-4 w-4 -rotate-90 opacity-60" />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-5 py-4 border-t border-border-soft/40 text-[11px] text-text-muted">
          <span className="bg-gradient-to-r from-accent to-accent-3 bg-clip-text text-transparent font-semibold">
            Network Posture Scanner
          </span>
          {" · v0.1"}
        </div>
      </aside>
    </>
  );
}
