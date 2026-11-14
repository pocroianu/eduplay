'use client';

import { motion, useReducedMotion } from 'framer-motion';

export type VulpitaMood = 'idle' | 'happy' | 'cheer' | 'think' | 'sad' | 'sleep';

export type VulpitaBandana = 'green' | 'gold' | 'coral' | null;

export interface VulpitaProps {
  size?: number;
  mood?: VulpitaMood;
  bandana?: VulpitaBandana;
  ariaLabel?: string;
  className?: string;
  animate?: boolean;
}

const BANDANA_FILL: Record<Exclude<VulpitaBandana, null>, string> = {
  green: 'var(--color-primary)',
  gold: 'var(--color-gold)',
  coral: 'var(--color-coral)',
};

function Eyes({ mood }: { mood: VulpitaMood }) {
  if (mood === 'sleep') {
    return (
      <>
        <path d="M 48 44 Q52 46 56 44" stroke="var(--color-ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 64 44 Q68 46 72 44" stroke="var(--color-ink)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </>
    );
  }
  if (mood === 'sad') {
    return (
      <>
        <ellipse cx="52" cy="44" rx="4" ry="5" fill="var(--color-ink)" />
        <ellipse cx="68" cy="44" rx="4" ry="5" fill="var(--color-ink)" />
        <circle cx="53.5" cy="42" r="1.5" fill="#fff" />
        <circle cx="69.5" cy="42" r="1.5" fill="#fff" />
        {/* Sad eyebrows — inner ends raised */}
        <path d="M 46 38 Q50 36 56 39" stroke="var(--color-ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M 74 38 Q70 36 64 39" stroke="var(--color-ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </>
    );
  }
  const ry = mood === 'cheer' ? 3 : 5;
  return (
    <>
      <ellipse cx="52" cy="44" rx="4" ry={ry} fill="var(--color-ink)" />
      <ellipse cx="68" cy="44" rx="4" ry={ry} fill="var(--color-ink)" />
      <circle cx="53.5" cy="42" r="1.5" fill="#fff" />
      <circle cx="69.5" cy="42" r="1.5" fill="#fff" />
    </>
  );
}

function Mouth({ mood }: { mood: VulpitaMood }) {
  switch (mood) {
    case 'idle':
      return <path d="M 57 59 Q60 61 63 59" stroke="var(--color-ink)" strokeWidth="2" fill="none" strokeLinecap="round" />;
    case 'happy':
      return <path d="M 56 58 Q60 62 64 58" stroke="var(--color-ink)" strokeWidth="2" fill="none" strokeLinecap="round" />;
    case 'cheer':
      return <path d="M 54 56 Q60 66 66 56 Q60 60 54 56 Z" fill="var(--color-vulpita-mouth)" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />;
    case 'think':
      return <path d="M 56 60 L64 60" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />;
    case 'sad':
      return <path d="M 56 62 Q60 58 64 62" stroke="var(--color-ink)" strokeWidth="2" fill="none" strokeLinecap="round" />;
    case 'sleep':
      return <path d="M 56 60 Q60 58 64 60" stroke="var(--color-ink)" strokeWidth="2" fill="none" strokeLinecap="round" />;
  }
}

export function Vulpita({
  size = 120,
  mood = 'idle',
  bandana = 'green',
  ariaLabel = 'Vulpița, vulpea EduPlay',
  className,
  animate = true,
}: VulpitaProps) {
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = animate && !shouldReduceMotion;

  const bandanaFill = bandana ? BANDANA_FILL[bandana] : undefined;

  const svg = (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-label={ariaLabel} role="img">
      {/* Tail */}
      <path d="M 92 78 Q110 68 104 52 Q94 58 88 70 Z" fill="var(--color-vulpita-fur-light)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M 100 58 Q108 56 104 52" fill="var(--color-vulpita-cream)" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
      {/* Body */}
      <ellipse cx="60" cy="78" rx="32" ry="28" fill="var(--color-vulpita-fur)" stroke="var(--color-ink)" strokeWidth="2.5" />
      {/* Belly */}
      <ellipse cx="60" cy="82" rx="18" ry="16" fill="var(--color-vulpita-cream)" />
      {/* Feet */}
      <ellipse cx="48" cy="104" rx="7" ry="4" fill="var(--color-ink)" />
      <ellipse cx="72" cy="104" rx="7" ry="4" fill="var(--color-ink)" />
      <g>
        {/* Head */}
        <circle cx="60" cy="46" r="28" fill="var(--color-vulpita-fur)" stroke="var(--color-ink)" strokeWidth="2.5" />
        {/* Ears */}
        <path d="M 40 30 L34 16 L50 26 Z" fill="var(--color-vulpita-fur)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M 40 26 L38 20 L46 25 Z" fill="var(--color-ink)" />
        <path d="M 80 30 L86 16 L70 26 Z" fill="var(--color-vulpita-fur)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M 80 26 L82 20 L74 25 Z" fill="var(--color-ink)" />
        {/* Face markings */}
        <path d="M 60 48 Q50 60 48 56 Q46 46 52 40 Z" fill="var(--color-vulpita-cream)" />
        <path d="M 60 48 Q70 60 72 56 Q74 46 68 40 Z" fill="var(--color-vulpita-cream)" />
        {/* Eyes */}
        <Eyes mood={mood} />
        {/* Cheeks */}
        <circle cx="44" cy="54" r="3.5" fill="var(--color-coral)" opacity="0.7" />
        <circle cx="76" cy="54" r="3.5" fill="var(--color-coral)" opacity="0.7" />
        {/* Nose */}
        <path d="M 58 52 L62 52 L60 56 Z" fill="var(--color-ink)" />
        {/* Mouth */}
        <Mouth mood={mood} />
      </g>
      {/* Bandana */}
      {bandanaFill && (
        <>
          <path d="M 34 68 Q60 76 86 68 L84 74 Q60 82 36 74 Z" fill={bandanaFill} stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="50" cy="71" r="1.5" fill="#fff" />
          <circle cx="60" cy="73" r="1.5" fill="#fff" />
          <circle cx="70" cy="71" r="1.5" fill="#fff" />
        </>
      )}
    </svg>
  );

  if (!shouldAnimate) return svg;

  return (
    <motion.div
      style={{ display: 'inline-block', width: size, height: size }}
      animate={{ y: [-1, 1, -1] }}
      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
    >
      {svg}
    </motion.div>
  );
}
