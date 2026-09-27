import { useId } from 'react';

export const BRAND_NAME = 'Saba AgriCo.';

type SabaAgriLogoProps = {
  variant?: 'full' | 'icon';
  height?: number;
  className?: string;
  tagline?: string;
  light?: boolean;
};

function Emblem({ size, className = '' }: { size: number; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const disc = `sa-disc-${uid}`;
  const gold = `sa-gold-${uid}`;
  return (
    <svg
      viewBox="0 0 160 160"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role="img"
      aria-label={BRAND_NAME}
    >
      <defs>
        <linearGradient id={disc} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#15803D" />
          <stop offset="1" stopColor="#14532D" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="70" fill="none" stroke="#22C55E" strokeOpacity="0.35" strokeWidth="3" />
      <path d="M80 10A70 70 0 0 1 146.57 58.37" fill="none" stroke={`url(#${gold})`} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="80" cy="10" r="5" fill="#F59E0B" />
      <circle cx="146.57" cy="58.37" r="5" fill="#F59E0B" />
      <circle cx="19.38" cy="115" r="4.5" fill="#22C55E" />
      <circle cx="115" cy="140.62" r="4.5" fill="#22C55E" />
      <circle cx="80" cy="80" r="54" fill={`url(#${disc})`} />
      <circle cx="80" cy="80" r="62" fill="none" stroke="#86EFAC" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="2 6" />
      <path d="M100 56C104 42 114 37 122 38C121 49 113 57 100 56Z" fill="#86EFAC" />
      <path d="M100 56C93 45 94 34 100 27C107 35 107 46 100 56Z" fill="#BBF7D0" />
      <path
        d="M100 56C94 48 70 46 64 58C58 70 74 76 82 80C92 85 102 92 96 104C90 116 66 114 60 106"
        fill="none"
        stroke="#ECFDF5"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <circle cx="81" cy="80" r="7.5" fill={`url(#${gold})`} stroke="#FEF3C7" strokeWidth="2" />
    </svg>
  );
}

export default function SabaAgriLogo({
  variant = 'full',
  height = 40,
  className = '',
  tagline,
  light = false,
}: SabaAgriLogoProps) {
  if (variant === 'icon') {
    return <Emblem size={height} className={className} />;
  }

  const nameSize = Math.max(13, Math.round(height * 0.42));
  const taglineSize = Math.max(9, Math.round(height * 0.27));

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <Emblem size={height} />
      <div className="min-w-0 leading-tight">
        <div
          className={`truncate font-extrabold tracking-tight ${light ? 'text-white' : 'text-nursery-950'}`}
          style={{ fontSize: nameSize }}
        >
          Saba <span className={light ? 'text-green-300' : 'text-forest-700'}>AgriCo</span>
          <span className="text-amber-500">.</span>
        </div>
        {tagline ? (
          <div
            className={`truncate font-medium tracking-wide ${light ? 'text-nursery-200' : 'text-nursery-600'}`}
            style={{ fontSize: taglineSize }}
          >
            {tagline}
          </div>
        ) : null}
      </div>
    </div>
  );
}
