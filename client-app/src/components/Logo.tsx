type LogoProps = {
  className?: string;
};

export function LogoMark({ className = 'h-11 w-11' }: LogoProps) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Saba Nursery">
      <rect width="64" height="64" rx="16" fill="#15803D" />
      <path d="M32 10c11 7 18 16 18 27 0 9-7 16-18 16S14 46 14 37C14 26 21 17 32 10z" fill="#ECFDF5" />
      <path d="M32 16v32" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M32 24l8 5M32 33l9 6M32 24l-8 5M32 33l-9 6"
        stroke="#15803D"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="48" cy="16" r="4" fill="#fef3c7" />
    </svg>
  );
}

export function BrandLockup({
  light = false,
  subtitle = 'Enterprise System',
  compact = false,
}: {
  light?: boolean;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <LogoMark className={`shrink-0 shadow-sm ${compact ? 'h-8 w-8' : 'h-11 w-11'}`} />
      <div className="min-w-0 leading-tight">
        <div className={`truncate font-bold tracking-tight ${compact ? 'text-[13px]' : 'text-sm'} ${light ? 'text-white' : 'text-nursery-950'}`}>
          Saba Nursery
        </div>
        <div className={`truncate font-medium tracking-wide ${compact ? 'text-[10px]' : 'text-[11px]'} ${light ? 'text-nursery-200' : 'text-nursery-600'}`}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}
