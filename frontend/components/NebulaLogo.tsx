"use client";

/**
 * NEBULA brand mark: an original orbital glowing-nebula glyph with an
 * AI/browser-agent cue (the orbiting node) — drawn as inline SVG so it renders
 * everywhere without external assets.
 */
export function NebulaMark({ size = 34, animate = true }: { size?: number; animate?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="NEBULA mark"
      className={animate ? "animate-float" : undefined}
    >
      <defs>
        <radialGradient id="neb-core" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="45%" stopColor="#8a72ff" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.15" />
        </radialGradient>
        <linearGradient id="neb-ring" x1="4" y1="40" x2="44" y2="8">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a99bff" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
        <filter id="neb-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx="24" cy="24" r="9" fill="url(#neb-core)" opacity="0.95" />
      <circle cx="24" cy="24" r="12.5" stroke="url(#neb-ring)" strokeOpacity="0.35" strokeWidth="1" />

      <g filter="url(#neb-blur)">
        <ellipse cx="24" cy="24" rx="19" ry="7.5" transform="rotate(-24 24 24)"
                 stroke="url(#neb-ring)" strokeWidth="1.9" />
        <ellipse cx="24" cy="24" rx="19" ry="7.5" transform="rotate(28 24 24)"
                 stroke="url(#neb-ring)" strokeOpacity="0.55" strokeWidth="1.2" />
      </g>

      {/* orbiting agent node */}
      <g style={{ transformOrigin: "24px 24px" }} className={animate ? "animate-orbit" : undefined}>
        <circle cx="41" cy="15" r="2.6" fill="#22d3ee" />
        <circle cx="41" cy="15" r="4.6" fill="#22d3ee" opacity="0.22" />
      </g>
    </svg>
  );
}

export function NebulaWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-[0.34em] ${className}`} aria-label="NEBULA">
      NEBULA
    </span>
  );
}

export function NebulaLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <NebulaMark size={compact ? 26 : 32} />
      {!compact && (
        <span className="leading-none">
          <NebulaWordmark className="block text-[15px] text-white" />
          <span className="mt-1 block text-[9px] uppercase tracking-[0.28em] text-[var(--color-accent-300)]/80">
            browser agent
          </span>
        </span>
      )}
    </span>
  );
}
