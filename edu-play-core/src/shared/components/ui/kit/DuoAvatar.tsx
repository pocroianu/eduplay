import { cn } from '@/shared/lib/utils/cn';

type AvatarTone = 'green' | 'gold' | 'blue' | 'coral' | 'purple' | 'pink';
type AvatarRing = 'gold' | 'green' | 'coral' | null;

export interface DuoAvatarProps {
  name: string;
  tone?: AvatarTone;
  size?: number;
  ring?: AvatarRing | string;
  className?: string;
}

const PALETTE: ReadonlyArray<{ tone: AvatarTone; bg: string; fg: string }> = [
  { tone: 'green', bg: 'var(--color-primary)', fg: 'var(--color-surface-container-lowest)' },
  { tone: 'blue', bg: 'var(--color-blue)', fg: 'var(--color-surface-container-lowest)' },
  { tone: 'coral', bg: 'var(--color-coral)', fg: 'var(--color-surface-container-lowest)' },
  { tone: 'gold', bg: 'var(--color-gold)', fg: 'var(--color-gold-deep)' },
  { tone: 'purple', bg: 'var(--color-purple)', fg: 'var(--color-surface-container-lowest)' },
  { tone: 'pink', bg: 'var(--color-pink)', fg: 'var(--color-surface-container-lowest)' },
];

const RING_COLOR: Record<Exclude<AvatarRing, null>, string> = {
  gold: 'var(--color-gold)',
  green: 'var(--color-primary)',
  coral: 'var(--color-coral)',
};

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function DuoAvatar({
  name,
  tone,
  size = 44,
  ring,
  className,
}: DuoAvatarProps) {
  const { bg, fg } = tone
    ? (PALETTE.find((entry) => entry.tone === tone) ?? PALETTE[0])
    : PALETTE[hashName(name) % PALETTE.length];

  return (
    <div
      role="img"
      aria-label={name}
      className={cn('inline-flex items-center justify-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: bg,
        color: fg,
        border: ring ? `3px solid ${ring in RING_COLOR ? RING_COLOR[ring as Exclude<AvatarRing, null>] : ring}` : undefined,
      }}
    >
      <span className="font-bold leading-none select-none">
        {getInitials(name)}
      </span>
    </div>
  );
}
