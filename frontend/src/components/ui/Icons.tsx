import type { SVGProps } from "react";

const base = "h-4 w-4";

export const Icon = {
  Shield: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  Server: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="4" width="18" height="6" rx="2"/>
      <rect x="3" y="14" width="18" height="6" rx="2"/>
      <path d="M7 7h.01M7 17h.01"/>
    </svg>
  ),
  Wall: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 5h18M3 12h18M3 19h18"/>
      <path d="M8 5v7M16 5v7M5 12v7M19 12v7M12 12v7"/>
    </svg>
  ),
  Alert: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 9v4M12 17h.01"/>
      <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    </svg>
  ),
  Check: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 6 9 17l-5-5"/>
    </svg>
  ),
  X: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M18 6 6 18M6 6l12 12"/>
    </svg>
  ),
  Sun: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
    </svg>
  ),
  Moon: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  ),
  Radar: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 12 21 6"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  ),
  Activity: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M22 12h-4l-3 9-6-18-3 9H2"/>
    </svg>
  ),
  Chevron: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  ),
  Sparkles: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/>
      <path d="M19 15v4M21 17h-4M5 4v3M6.5 5.5h-3"/>
    </svg>
  ),
  Menu: (p: SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  ),
};
