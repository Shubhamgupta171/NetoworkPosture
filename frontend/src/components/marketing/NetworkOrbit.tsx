/**
 * Animated radar / network visualization for the brand hero.
 *
 * Pure SVG + CSS. Shows three concentric rings, a sweeping radar arm, and
 * "discovered host" dots that pulse in succession to imply continuous scanning.
 */
export function NetworkOrbit() {
  // Discovered host dots — placed on different rings.
  const hosts = [
    { r: 64,  angle: 18,  label: "EC2" },
    { r: 64,  angle: 142, label: "Cisco IOS" },
    { r: 64,  angle: 268, label: "Linux" },
    { r: 100, angle: 70,  label: "AWS SG" },
    { r: 100, angle: 200, label: "Bastion" },
    { r: 100, angle: 320, label: "Postgres" },
    { r: 138, angle: 32,  label: "S3" },
    { r: 138, angle: 178, label: "JunOS" },
    { r: 138, angle: 286, label: "VPN" },
  ];
  const cx = 150, cy = 150;

  return (
    <div className="relative w-full max-w-md mx-auto aspect-square">
      <svg viewBox="0 0 300 300" className="w-full h-full" aria-hidden>
        <defs>
          <radialGradient id="orbit-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--accent) / 0.55)" />
            <stop offset="55%" stopColor="rgb(var(--accent-2) / 0.18)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.6" />
          </linearGradient>
          <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Glow halo */}
        <circle cx={cx} cy={cy} r="140" fill="url(#orbit-glow)" />

        {/* Concentric rings */}
        {[64, 100, 138].map((r, i) => (
          <circle
            key={r}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgb(var(--accent) / 0.18)"
            strokeWidth="1"
            strokeDasharray={i === 1 ? "2 4" : i === 2 ? "1 6" : "0"}
          />
        ))}

        {/* Radar sweep arm — rotates continuously */}
        <g style={{ transformOrigin: `${cx}px ${cy}px` }} className="orbit-sweep">
          <path
            d={`M ${cx} ${cy} L ${cx + 138} ${cy} A 138 138 0 0 0 ${cx + 138 * Math.cos(-Math.PI / 3.2)} ${cy + 138 * Math.sin(-Math.PI / 3.2)} Z`}
            fill="url(#sweep)"
            opacity="0.55"
          />
          <line
            x1={cx} y1={cy}
            x2={cx + 140} y2={cy}
            stroke="rgb(var(--accent))" strokeWidth="1.5" opacity="0.85"
          />
        </g>

        {/* Discovered host dots */}
        {hosts.map((h, idx) => {
          const rad = (h.angle * Math.PI) / 180;
          const x = cx + h.r * Math.cos(rad);
          const y = cy + h.r * Math.sin(rad);
          return (
            <g key={idx}>
              <circle
                cx={x} cy={y} r="6"
                fill="rgb(var(--accent) / 0.18)"
                filter="url(#ring-glow)"
                style={{ animation: `orbitPulse 3.4s ease-in-out ${idx * 0.35}s infinite` }}
              />
              <circle
                cx={x} cy={y} r="3"
                fill="rgb(var(--accent))"
                style={{
                  animation: `orbitDot 3.4s ease-in-out ${idx * 0.35}s infinite`,
                  filter: "drop-shadow(0 0 4px rgb(var(--accent)))",
                }}
              />
            </g>
          );
        })}

        {/* Centre node — the scanner */}
        <circle cx={cx} cy={cy} r="12" fill="rgb(var(--surface-1))" stroke="rgb(var(--accent))" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="5" fill="rgb(var(--accent))">
          <animate attributeName="r" values="4;7;4" dur="2s" repeatCount="indefinite" />
        </circle>
        <text
          x={cx} y={cy + 30}
          textAnchor="middle"
          className="fill-text-muted"
          style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase" }}
        >
          scanner
        </text>

        {/* Faint cardinal markers */}
        {[0, 90, 180, 270].map((a) => {
          const r = 152;
          const rad = (a * Math.PI) / 180;
          const x = cx + r * Math.cos(rad);
          const y = cy + r * Math.sin(rad);
          return (
            <circle
              key={a}
              cx={x} cy={y} r="1.2"
              fill="rgb(var(--text-muted))"
            />
          );
        })}
      </svg>

      <style>{`
        .orbit-sweep { animation: orbitSweep 6s linear infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes orbitSweep {
          to { transform: rotate(360deg); }
        }
        @keyframes orbitPulse {
          0%, 100% { opacity: 0.25; r: 5; }
          50%      { opacity: 0.85; r: 9; }
        }
        @keyframes orbitDot {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1;    }
        }
        @media (prefers-reduced-motion: reduce) {
          .orbit-sweep { animation: none; }
        }
      `}</style>
    </div>
  );
}
