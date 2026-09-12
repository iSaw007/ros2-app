// A small, deliberately plain icon set.
//
// Every icon is a 24x24 stroked path on currentColor at a consistent 1.5px
// weight, so icons inherit their colour from the surrounding text and stay
// visually subordinate to it. They mark controls; they are not ornament, and
// nothing in this interface uses an icon where a word would be clearer.

type IconProps = {
  size?: number;
  className?: string;
};

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({
  size = 18,
  className = "",
  children,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const OverviewIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="8" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="3" y="15" width="7" height="6" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
  </Svg>
);

export const TeleopIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </Svg>
);

export const MapIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M9 4 3 6.5v13L9 17l6 3 6-2.5v-13L15 7 9 4Z" />
    <path d="M9 4v13M15 7v13" />
  </Svg>
);

export const DockIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 3v6M17 3v6" />
    <path d="M4 9h16v3a8 8 0 0 1-16 0V9Z" />
    <path d="M12 20v2" />
  </Svg>
);

export const MenuIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Svg>
);

export const CloseIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);

export const SunIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const MoonIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </Svg>
);

export const PlusIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MinusIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const FitIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
  </Svg>
);

export const CrosshairIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="1.5" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" />
    <path d="M4 4v4.5h4.5" />
    <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" />
    <path d="M20 20v-4.5h-4.5" />
  </Svg>
);

export const StopIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
  </Svg>
);

export const PlayIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </Svg>
);

export const WarningIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
    <path d="M12 10v4.5M12 17.5v.01" />
  </Svg>
);

export const LinkOffIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M9.5 14.5 7 17a3.5 3.5 0 0 1-5-5l2.5-2.5M14.5 9.5 17 7a3.5 3.5 0 0 1 5 5l-2.5 2.5" />
    <path d="M3 3l18 18" />
  </Svg>
);

export const CameraIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 9.3 4.7h5.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-9Z" />
    <circle cx="12" cy="12.75" r="3.25" />
  </Svg>
);

export const CameraOffIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h1.7M9.6 5.15A1 1 0 0 1 10.3 4.7h5.4a1 1 0 0 1 .83.45l.94 1.4a1 1 0 0 0 .83.45h2.2A1.5 1.5 0 0 1 22 8.5v8" />
    <path d="M20.2 19H4.5A1.5 1.5 0 0 1 3 17.5v-6" />
    <path d="M3 3l18 18" />
  </Svg>
);

export const ExpandIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7" />
  </Svg>
);

export const CollapseIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M20 10h-6V4M14 10l7-7M4 14h6v6M10 14l-7 7" />
  </Svg>
);
