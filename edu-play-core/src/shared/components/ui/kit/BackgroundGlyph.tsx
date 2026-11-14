'use client';

export type BackgroundGlyphKind = 'squiggle' | 'dotGrid' | 'blob';
export type BackgroundGlyphTone =
  | 'green'
  | 'blue'
  | 'coral'
  | 'gold'
  | 'purple'
  | 'pink'
  | 'ink';

export interface BackgroundGlyphProps {
  kind: BackgroundGlyphKind;
  tone?: BackgroundGlyphTone;
  size?: number;
  opacity?: number;
  className?: string;
}

const TONE_COLOR: Record<BackgroundGlyphTone, string> = {
  green: 'var(--color-primary)',
  blue: 'var(--color-blue)',
  coral: 'var(--color-coral)',
  gold: 'var(--color-gold)',
  purple: 'var(--color-purple)',
  pink: 'var(--color-pink)',
  ink: 'var(--color-ink)',
};

export function BackgroundGlyph({
  kind,
  tone = 'green',
  size = 160,
  opacity = 0.18,
  className,
}: BackgroundGlyphProps) {
  const stroke = TONE_COLOR[tone];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      className={className}
      aria-hidden="true"
      style={{ opacity }}
    >
      {kind === 'squiggle' && (
        <path
          d="M 8 80 Q28 40 48 80 T88 80 T128 80 T168 80"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {kind === 'dotGrid' && (
        <g fill={stroke}>
          {Array.from({ length: 6 }).map((_, row) =>
            Array.from({ length: 6 }).map((__, col) => (
              <circle
                key={`${row}-${col}`}
                cx={20 + col * 24}
                cy={20 + row * 24}
                r={3}
              />
            )),
          )}
        </g>
      )}

      {kind === 'blob' && (
        <path
          d="M 44 32 Q80 14 116 36 Q142 60 132 96 Q120 134 80 138 Q40 136 24 102 Q14 64 44 32 Z"
          fill={stroke}
        />
      )}
    </svg>
  );
}
