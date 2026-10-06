type IconProps = { className?: string };

function Base({
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z" />
      <path d="M9.5 12l2 2 3.5-4" />
    </Base>
  );
}

export function RadarIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
      <path d="M12 12l6-6" />
    </Base>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </Base>
  );
}

export function DocIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M7 3h7l4 4v14H7V3z" />
      <path d="M14 3v4h4" />
      <path d="M10 12h5M10 16h5" />
    </Base>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <Base className={className}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </Base>
  );
}
