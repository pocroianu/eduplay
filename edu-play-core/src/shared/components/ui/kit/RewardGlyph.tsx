'use client';

export type RewardGlyphKind = 'heart' | 'gem' | 'xp' | 'trophy' | 'flame';

export interface RewardGlyphProps {
  kind: RewardGlyphKind;
  size?: number;
  className?: string;
}

export interface DuoFlameProps {
  size?: number;
  on?: boolean;
  className?: string;
}

export function DuoFlame({ size = 32, on = true, className }: DuoFlameProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M 16 2 C20 7 24 9 24 15 C24 20 20 24 16 24 C12 24 8 20 8 15 C8 12 10 10 11 12 C11 8 14 5 16 2 Z"
        fill={on ? 'var(--color-coral)' : 'var(--color-outline)'}
        stroke={on ? 'var(--color-coral-dim)' : 'var(--color-on-surface-faint)'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M 16 10 C18 13 20 14 20 17 C20 20 18 22 16 22 C14 22 12 20 12 17 C12 16 13 15 14 16 C14 14 15 12 16 10 Z"
        fill={on ? 'var(--color-gold)' : 'var(--color-outline-variant)'}
      />
    </svg>
  );
}

export function RewardGlyph({ kind, size = 22, className }: RewardGlyphProps) {
  if (kind === 'flame') return <DuoFlame size={size} className={className} />;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      {kind === 'heart' && (
        <path
          d="M 12 21 C5 15 2 11 2 7 C2 4 4 2 7 2 C9 2 11 3 12 5 C13 3 15 2 17 2 C20 2 22 4 22 7 C22 11 19 15 12 21 Z"
          fill="var(--color-coral)"
          stroke="var(--color-coral-dim)"
          strokeWidth="1.5"
        />
      )}
      {kind === 'gem' && (
        <>
          <path
            d="M 12 2 L22 10 L12 22 L2 10 Z"
            fill="var(--color-blue)"
            stroke="var(--color-blue-dim)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M 7 10 L12 6 L17 10 L12 14 Z" fill="#fff" opacity="0.35" />
        </>
      )}
      {kind === 'xp' && (
        <path
          d="M 12 2 L14 9 L22 9 L16 13 L18 21 L12 16 L6 21 L8 13 L2 9 L10 9 Z"
          fill="var(--color-gold)"
          stroke="var(--color-gold-dim)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
      {kind === 'trophy' && (
        <>
          <path
            d="M 6 4 H18 V9 C18 13 15 16 12 16 C9 16 6 13 6 9 Z"
            fill="var(--color-gold)"
            stroke="var(--color-gold-dim)"
            strokeWidth="1.5"
          />
          <path
            d="M 3 5 H6 V9 C6 10 5 11 4 11 C3 11 2 10 2 9 V6 C2 5.4 2.4 5 3 5 Z"
            fill="var(--color-gold)"
            stroke="var(--color-gold-dim)"
            strokeWidth="1.5"
          />
          <path
            d="M 21 5 H18 V9 C18 10 19 11 20 11 C21 11 22 10 22 9 V6 C22 5.4 21.6 5 21 5 Z"
            fill="var(--color-gold)"
            stroke="var(--color-gold-dim)"
            strokeWidth="1.5"
          />
          <rect x="9" y="16" width="6" height="3" fill="var(--color-gold-dim)" />
          <rect x="7" y="19" width="10" height="3" rx="1" fill="var(--color-ink)" />
        </>
      )}
    </svg>
  );
}
