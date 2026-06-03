// Design-spec icon set — 18px line icons, 1.6 stroke
// All icons accept size, className, and style props

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}

function Icon({
  d,
  size = 18,
  strokeWidth = 1.6,
  fill = "none",
  className,
  style,
}: IconProps & { d: React.ReactNode; fill?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {d}
    </svg>
  );
}

export const IBudget = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="M3 7h18" />
        <path d="M5 7v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7" />
        <path d="M9 4h6a2 2 0 0 1 2 2v1H7V6a2 2 0 0 1 2-2Z" />
        <path d="M9 12h6" />
        <path d="M9 16h3" />
      </>
    }
  />
);

export const ICash = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M6 10v.01M18 14v.01" />
      </>
    }
  />
);

export const ITax = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M15 3v4h4" />
        <path d="M8 12h8M8 16h6" />
      </>
    }
  />
);

export const IReview = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    }
  />
);

export const IBolt = (p: IconProps) => (
  <Icon
    {...p}
    strokeWidth={2}
    d={<path d="M13 2 3 14h8l-1 8 10-12h-8l1-8z" />}
    fill="currentColor"
  />
);

/** Tax Triage — card stack / quick sort */
export const ITriage = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <rect x="5" y="4" width="14" height="16" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
        <path d="M16 4v3a1 1 0 0 0 1 1h2" />
      </>
    }
  />
);

export const IAccounts = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v9h14v-9" />
        <path d="M9 19v-5M12 19v-5M15 19v-5" />
        <path d="M3 21h18" />
      </>
    }
  />
);

export const ISettings = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
      </>
    }
  />
);

export const IChevronL = (p: IconProps) => (
  <Icon {...p} d={<path d="m15 6-6 6 6 6" />} />
);
export const IChevronR = (p: IconProps) => (
  <Icon {...p} d={<path d="m9 6 6 6-6 6" />} />
);
export const IChevronD = (p: IconProps) => (
  <Icon {...p} d={<path d="m6 9 6 6 6-6" />} />
);
export const IChevronU = (p: IconProps) => (
  <Icon {...p} d={<path d="m18 15-6-6-6 6" />} />
);

export const IPlus = (p: IconProps) => (
  <Icon {...p} d={<path d="M12 5v14M5 12h14" />} />
);

export const ISearch = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    }
  />
);

export const IBank = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="M3 10 12 4l9 6" />
        <path d="M5 10v9h14v-9" />
        <path d="M9 19v-5M15 19v-5M12 19v-5" />
      </>
    }
  />
);

export const ICheck = (p: IconProps) => (
  <Icon {...p} d={<path d="m5 12 5 5 9-11" />} />
);

export const IClose = (p: IconProps) => (
  <Icon {...p} d={<path d="M6 6l12 12M18 6 6 18" />} />
);

export const IDonut = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 7 4" />
      </>
    }
  />
);

export const IList = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
      </>
    }
  />
);

export const ITrendUp = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="m4 17 6-6 4 4 6-8" />
        <path d="M14 7h6v6" />
      </>
    }
  />
);

export const ITrendDn = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="m4 7 6 6 4-4 6 8" />
        <path d="M14 17h6v-6" />
      </>
    }
  />
);

export const IRules = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="M4 6h12M4 12h8M4 18h12" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="15" cy="12" r="2" />
        <circle cx="19" cy="18" r="2" />
      </>
    }
  />
);

export const IInfo = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v.01M11 12h1v5" />
      </>
    }
  />
);

export const IDrag = (p: IconProps) => (
  <Icon
    {...p}
    strokeWidth={0}
    fill="currentColor"
    d={
      <>
        <circle cx="9" cy="6" r="1" />
        <circle cx="9" cy="12" r="1" />
        <circle cx="9" cy="18" r="1" />
        <circle cx="15" cy="6" r="1" />
        <circle cx="15" cy="12" r="1" />
        <circle cx="15" cy="18" r="1" />
      </>
    }
  />
);

export const ISpark2 = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.5 5.5l2 2M16.5 16.5l2 2M5.5 18.5l2-2M16.5 7.5l2-2" />
    }
  />
);

export const IExport = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="M12 3v12" />
        <path d="m7 8 5-5 5 5" />
        <path d="M4 17v3h16v-3" />
      </>
    }
  />
);

export const ILink = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1" />
        <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1" />
      </>
    }
  />
);

export const IUser = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
      </>
    }
  />
);

export const ITrash = (p: IconProps) => (
  <Icon
    {...p}
    d={
      <>
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4h6v2" />
      </>
    }
  />
);
