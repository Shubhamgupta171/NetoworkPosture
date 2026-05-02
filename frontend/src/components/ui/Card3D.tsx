import { useRef, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";

interface Card3DProps {
  children: ReactNode;
  className?: string;
  /** Maximum tilt in degrees on each axis. Lower = subtler. */
  intensity?: number;
  /** Disable the tilt entirely (e.g. for reduced motion). */
  flat?: boolean;
  style?: CSSProperties;
}

/**
 * Wraps a child element with a mouse-tracked 3D tilt + glare highlight.
 *
 * Implementation detail: we mutate CSS variables directly on the DOM node
 * rather than triggering React re-renders, so 60fps is comfortable even with
 * many cards on screen.
 */
export function Card3D({
  children,
  className,
  intensity = 6,
  flat = false,
  style,
}: Card3DProps) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (flat || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;  // 0..1
    const py = (e.clientY - rect.top) / rect.height;
    const ry = (px - 0.5) * intensity * 2;
    const rx = (0.5 - py) * intensity * 2;
    ref.current.style.setProperty("--rx", `${rx}deg`);
    ref.current.style.setProperty("--ry", `${ry}deg`);
    ref.current.style.setProperty("--mx", `${px * 100}%`);
    ref.current.style.setProperty("--my", `${py * 100}%`);
  }

  function onLeave() {
    if (!ref.current) return;
    ref.current.style.setProperty("--rx", "0deg");
    ref.current.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={style}
      className={clsx("card3d relative", className)}
    >
      {children}
      <div className="card3d-glare" aria-hidden />
    </div>
  );
}
