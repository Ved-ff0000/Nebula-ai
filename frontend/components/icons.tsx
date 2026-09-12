/**
 * Inline SVG icon set — original, dependency-free line icons.
 * Used instead of emoji glyphs so the UI renders identically on every OS
 * (no font/emoji fallback gaps) and in the sandboxed preview.
 */
type IconProps = { size?: number; className?: string };

const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
  "aria-hidden": true,
});

export const IconResearch = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5 5" />
    <path d="M8.5 10.5h4M10.5 8.5v4" />
  </svg>
);

export const IconCompare = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 6h6M4 12h6M4 18h6" />
    <path d="M14 6h6M14 12h6M14 18h6" />
  </svg>
);

export const IconTarget = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </svg>
);

export const IconSummarize = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);

export const IconForm = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M15.5 4.5l4 4L9 19H5v-4z" />
    <path d="M13.5 6.5l4 4" />
    <path d="M4 21h16" />
  </svg>
);

export const IconShield = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5V6z" />
    <path d="M9.2 12.2l2 2 3.6-4" />
  </svg>
);

export const IconBrowser = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="M3 9h18" />
    <circle cx="6.4" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPause = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M9 5v14M15 5v14" strokeWidth={2.2} />
  </svg>
);

export const IconStop = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPlay = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconFlag = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M6 21V4" />
    <path d="M6 4.5h11l-1.8 4 1.8 4H6z" />
  </svg>
);

export const IconCheck = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M5 12.5l4.2 4.2L19 7" strokeWidth={2} />
  </svg>
);

export const IconStar = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3.6l2.5 5.3 5.8.8-4.2 4 1 5.7-5.1-2.8-5.1 2.8 1-5.7-4.2-4 5.8-.8z" />
  </svg>
);

export const IconWarn = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 4l8.5 15h-17z" />
    <path d="M12 9.5v4.2M12 16.6v.6" strokeWidth={1.9} />
  </svg>
);

export const IconRefresh = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M20 11a8 8 0 1 0-2.3 6" />
    <path d="M20 4.5V11h-6" />
  </svg>
);

export const IconArrowRight = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const IconDot = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  </svg>
);

export const IconPlan = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 3.5l8.5 8.5L12 20.5 3.5 12z" />
    <path d="M12 8.5v3.8l2.6 1.6" />
  </svg>
);

export const IconHome = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
  </svg>
);

export const IconList = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <rect x="3.5" y="4" width="17" height="16" rx="2.5" />
    <path d="M7.5 9h9M7.5 13h9M7.5 17h5" />
  </svg>
);

export const IconActivity = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M3 12h4l2.5-6 4 12L16 12h5" />
  </svg>
);

export const IconSettings = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.9l1.9 1.1M17.2 15l1.9 1.1M4.9 16.1l1.9-1.1M17.2 9l1.9-1.1" />
  </svg>
);

export const IconPlus = ({ size = 20, className }: IconProps) => (
  <svg {...base(size, className)}>
    <path d="M12 5.5v13M5.5 12h13" strokeWidth={1.9} />
  </svg>
);
