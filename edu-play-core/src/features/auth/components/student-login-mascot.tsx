'use client';

import { cn } from '@/shared/lib/utils/cn';
import type { VulpitaMood } from '@/shared/components/ui/kit';

export interface StudentLoginMascotProps {
  mood: VulpitaMood;
  size?: number;
}

/**
 * Image-based mascot used exclusively on the student login surface. Mood is
 * communicated through CSS transforms on a single static fox illustration:
 *
 *   • happy / idle  → resting tone
 *   • cheer         → slight scale-up, signals success
 *   • think / sad   → small left tilt + softened saturation
 *   • sleep         → grayscale + reduced opacity (lockout)
 *
 * We trade per-mood SVG variants for a single high-quality illustration; the
 * Vulpița SVG mascot is still authoritative on other surfaces (dashboards,
 * RewardModal). One mascot per viewport rule still holds — the shell renders
 * this; the PIN pad never renders its own.
 */
export function StudentLoginMascot({ mood, size = 160 }: StudentLoginMascotProps) {
  return (
    // The wrapper carries the mood transform; the inner `<img>` carries
    // `mix-blend-multiply` so the white background bundled with the source
    // PNG drops into the page surface without us re-exporting the asset
    // with an alpha channel.
    <div
      aria-hidden="true"
      className={cn(
        // The outer motion wrappers create transformed stacking contexts that
        // isolate `mix-blend-mode`, so we have to paint a local copy of the
        // shell background here for the blend to land against.
        'bg-primary-wash transition-all duration-300 ease-out',
        mood === 'cheer' && 'scale-110',
        (mood === 'think' || mood === 'sad') && '-rotate-3 saturate-75',
        mood === 'sleep' && 'grayscale opacity-60',
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- mix-blend-multiply needs to apply to the raw <img>, not the Next.js Image wrapper. */}
      <img
        src="/mascot/vulpita.png"
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain mix-blend-multiply"
      />
    </div>
  );
}
