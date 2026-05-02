import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  durationMs?: number;
  suffix?: string;
  className?: string;
}

/** Smoothly counts up to `value` whenever it changes. */
export function AnimatedNumber({ value, durationMs = 700, suffix = "", className }: Props) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = null;
    let raf = 0;

    const step = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(next);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const rounded = Math.round(display);
  return <span className={className}>{rounded.toLocaleString()}{suffix}</span>;
}
