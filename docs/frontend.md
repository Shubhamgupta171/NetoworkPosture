# Frontend: architecture, components, styling

## Stack

| Layer | Choice | Why |
|------|-------|-----|
| Bundler | **Vite 5** | Fast HMR, ESBuild, no Webpack ceremony |
| Framework | **React 18** | Mature, broad familiarity, good React Query story |
| Language | **TypeScript** (strict) | Caught most bugs before runtime |
| State / data | **React Query** (`@tanstack/react-query`) | Cache + invalidation + retry built-in; no Redux needed |
| Styling | **Tailwind CSS 3** + custom CSS variables | Atomic classes for speed, semantic tokens for theming |
| Charts | **Recharts** | Composable, theme-aware, no canvas crimes |
| Icons | Inline SVG (`components/ui/Icons.tsx`) | Zero deps, full control, tree-shakeable |

No CSS-in-JS, no styled-components, no Material UI. The bundle is ~180 KB gzipped, of which a third is recharts.

## File layout

```
frontend/src/
├── main.tsx                    Bootstrap: ThemeProvider → QueryClientProvider → App
├── App.tsx                     Page composition + section anchors
├── index.css                   Tailwind layers + theme variables + glass/animation classes
├── lib/
│   ├── api.ts                  Typed fetch client + downloadFile helper
│   └── format.ts               Severity / outcome / source classes + relative time
├── theme/
│   └── ThemeProvider.tsx       Light / dark toggle backed by localStorage
└── components/
    ├── Header.tsx              Sticky top bar + mobile drawer
    ├── ThemeToggle.tsx         Animated sun/moon switch
    ├── RiskHeroCard.tsx        Circular pass-rate gauge
    ├── SummaryCards.tsx        4 stat tiles with 3D tilt + sparklines
    ├── SeverityChart.tsx       Recharts gradient bars
    ├── DevicesTable.tsx        Devices list (desktop table + mobile cards)
    ├── FirewallTable.tsx       Rules list with source/direction filters
    ├── CisResults.tsx          Expandable per-check accordion with evidence + remediation
    ├── EmptyState.tsx          Onboarding hint for empty store
    ├── marketing/
    │   ├── BrandHero.tsx       Tagline + animated network orbit + CTAs
    │   ├── NetworkOrbit.tsx    Pure-SVG radar with rotating sweep + pulsing dots
    │   ├── ProblemSection.tsx  4 real-world pain-point cards (also exports SectionHeader)
    │   ├── ValuePillars.tsx    4 product pillars (Discover / Parse / Audit / Report)
    │   ├── HowItWorks.tsx      3-step pipeline in plain English
    │   ├── CisCoverage.tsx     8 control cards driven by /cis-results/catalog
    │   └── TrustSection.tsx    Defensive-design promises + compliance commitments
    ├── scan/
    │   ├── ScanSection.tsx     Mode toggle (Instant / Recurring) + always-on schedules list
    │   ├── ScanForm.tsx        Targets textarea + sample-fixture checkboxes for one-shot scans
    │   ├── ScheduleForm.tsx    Same fields + interval presets for recurring scans
    │   └── SchedulesList.tsx   Active schedules table + pause / resume / delete actions
    ├── reports/
    │   └── ReportsTable.tsx    Past scans + PDF / CSV / JSON download buttons
    └── ui/
        ├── Card3D.tsx          Mouse-tracked tilt wrapper for stat cards
        ├── AnimatedNumber.tsx  RAF-driven count-up
        ├── Icons.tsx           Inline SVG icon set
        └── MobileCard.tsx      `<TableOnly>` / `<CardsOnly>` / `<MCard>` / `<MRow>`
```

## Theming

`index.css` defines two token sets:

```css
:root[data-theme="dark"] {
  --surface-base: 13 16 17;
  --surface-1:    28 28 29;
  --accent:        4 212 252;
  ...
}
:root[data-theme="light"] { ... }
```

`tailwind.config.js` maps semantic colours to those tokens:

```js
colors: {
  bg:      "rgb(var(--surface-base) / <alpha-value>)",
  surface: "rgb(var(--surface-1) / <alpha-value>)",
  accent:  "rgb(var(--accent) / <alpha-value>)",
  // ...
}
```

So `bg-accent/10` becomes `rgb(var(--accent) / 0.1)` and works in both themes. Switching themes is `<html data-theme="light">` — no class shuffling, no FOUC.

`index.html` runs a tiny inline script before React hydrates to set `data-theme` from localStorage, so there's no flash of wrong theme on cold load.

## The mobile responsive pattern

Tables don't fit on phones. The pattern across `DevicesTable`, `FirewallTable`, `ReportsTable`, and `SchedulesList` is the same:

```tsx
<TableOnly>   {/* hidden md:block */}
  <table>...</table>
</TableOnly>

<CardsOnly>   {/* md:hidden */}
  {rows.map((r) => (
    <MCard key={r.id}>
      <MRow label="…">…</MRow>
      ...
    </MCard>
  ))}
</CardsOnly>
```

Both views read from the same React Query result, so there's no duplicate fetching or state. The card layout shows the most important fields first (status, primary identifier) and stacks secondary metadata as label/value pairs underneath.

Other mobile-first decisions:

- **Header:** desktop nav is `lg:flex` only; below 1024 px the hamburger opens a slide-in drawer (`role="dialog" aria-modal="true"`, body-scroll lock, click-outside to close, auto-close on lg+ resize).
- **Form inputs:** `font-size: 16px` on `<input>`, `<textarea>`, `<select>` below the `sm` breakpoint to suppress iOS Safari's focus zoom; `14 px` from `sm+`.
- **CTAs and download buttons:** `min-h-[40px]` to `min-h-[48px]` so they comfortably hit the iOS 44pt / Android 48dp recommendations.
- **Scan mode toggle:** `grid-cols-1 sm:inline-flex` — stacks vertically on phones, segmented control on tablets+.
- **Vertical rhythm:** `py-8 md:py-14` instead of a flat `py-14` so the page doesn't feel infinite on mobile.

## Data fetching pattern

Every component owns its query:

```ts
const { data, isLoading, error } = useQuery({
  queryKey: ["devices"],
  queryFn:  api.devices,
});
```

A few opinions baked into the `QueryClient` config in `main.tsx`:

```ts
{
  refetchOnWindowFocus: false,  // prevents request storms when alt-tabbing
  retry: 1,                     // one network blip is fine; persistent failures should surface
  staleTime: 15_000,            // re-render from cache within 15s, refetch on next mount
}
```

Mutations (start scan, create / update / delete schedule, download report) all live in `lib/api.ts`. After a successful mutation, the calling component calls `qc.invalidateQueries(...)` for every key that's now stale — usually devices, rules, results, summary, scans, catalog. React Query then refetches them lazily as components re-render.

## Animations & 3D effects

- **Animated mesh-gradient background** — radial gradients drifting on a 24 s loop, theme-aware via CSS variables. Disabled by `prefers-reduced-motion: reduce`.
- **Card3D tilt** (`components/ui/Card3D.tsx`) — mouse-tracked perspective rotation + a glare highlight. Implemented by mutating CSS variables directly on the DOM node (no React re-renders), so 60 fps with many cards on screen.
- **AnimatedNumber** (`components/ui/AnimatedNumber.tsx`) — `requestAnimationFrame`-driven ease-out cubic count-up.
- **Gradient borders** (`.gradient-border`) — animated conic gradient using a CSS `@property --angle: <angle>` for browsers that support it; static fallback otherwise.
- **NetworkOrbit** — pure SVG with a rotating sweep arm + pulsing host dots, animated via inline `<style>` so the component is fully self-contained.

## Error handling in the UI

- API errors are parsed once in `request<T>()` — both raw text and JSON `{detail: "..."}` formats are recognised and thrown as `Error(message)`.
- Components show inline error states (`error: red banner`, `loading: …`, `empty: friendly nudge`) rather than crashing.
- Mutation failures (start scan, download) surface as toast-equivalents (badge pill or `alert()`).
- React Query catches retried failures and emits to the `error` field — never to the global error boundary unless we explicitly rethrow.

## Performance

- The bundle is **635 KB / 184 KB gzipped** in production. Recharts is the largest single contributor (~120 KB raw); easy to lazy-load with `React.lazy` if it ever matters.
- No virtualisation on lists. Tables max out around a few hundred rows — well under the scroll-perf cliff. Add `react-window` if you need to render 10k+ rows.
- No images other than the favicon SVG.
- Initial paint is one HTML doc + one CSS file + one JS bundle + the Inter / JetBrains Mono / Space Grotesk fonts (preconnect hints in `index.html`).

## Accessibility

- Semantic HTML: `<main>`, `<header>`, `<footer>`, `<nav>`, `<section>` with proper headings.
- Mobile drawer: `role="dialog" aria-modal="true" aria-label="Navigation menu"`; backdrop click + Esc handling.
- Focus outlines preserved (no global `outline: none`).
- All interactive controls are real `<button>` / `<a>` / `<input>` — no `<div onClick>` surprises.
- Theme toggle has `aria-label="Switch to light/dark theme"`.
- `prefers-reduced-motion` honoured for background drift, gradient border animation, and Card3D tilt.

Known gaps (planned in `design-decisions.md`): no live region for async updates, no keyboard shortcut to focus the scan form, no dedicated screen-reader-only labels on the icon-only chevron buttons.
