import type { Variants, Transition } from 'framer-motion';

// Transition presets
export const transitions = {
  smooth: { type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.3 } as Transition,
  press: { type: 'tween', ease: [0.4, 0, 0.2, 1], duration: 0.08 } as Transition,
} as const;

// Fade animations
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.smooth },
  exit: { opacity: 0, transition: transitions.smooth },
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: transitions.smooth },
  exit: { opacity: 0, y: 20, transition: transitions.smooth },
};



// Interactive animations
export const buttonTap: Variants = {
  tap: { y: 2, transition: transitions.press },
};

export const buttonHover: Variants = {
  hover: {
    y: -2,
    transition: transitions.smooth,
  },
};

// Floating animation (continuous)
export const float: Variants = {
  initial: {},
  animate: {
    y: [-5, 5, -5],
    transition: {
      repeat: Infinity,
      duration: 3,
      ease: 'easeInOut',
    },
  },
};

// Quick horizontal shake used on wrong-PIN feedback
export const pinShake: Variants = {
  idle: { x: 0 },
  shake: {
    x: [-6, 6, -6, 6, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
};

// Card animations
export const cardHover: Variants = {
  hover: {
    y: -2,
    boxShadow: 'var(--shadow-soft)',
    transition: transitions.smooth,
  },
};

export const cardTap: Variants = {
  tap: { y: 2, transition: transitions.press },
};

export const thumbnailZoom: Variants = {
  hover: { y: -2, transition: { duration: 0.24, ease: 'easeOut' } },
};

// Slide animations
export const slideIn: Variants = {
  initial: { x: -100, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: transitions.smooth },
  exit: { x: 100, opacity: 0, transition: transitions.smooth },
};

// List item stagger animation
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
};

// ---------------------------------------------------------------------------
// Reduced-motion variants
//
// Every preset above has a calm counterpart: no loops, no transforms, no
// springs; at most a short opacity fade. `motionPreset` picks between them so
// call sites can stay a single line: `variants={motionPreset('float', reduced)}`.
// ---------------------------------------------------------------------------

const reducedFade = { duration: 0.15, ease: 'easeOut' } as Transition;

const reducedEntrance: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: reducedFade },
  exit: { opacity: 0, transition: reducedFade },
};

const reducedStatic: Variants = {};

export const motionPresets = {
  fadeIn,
  fadeInUp,
  buttonTap,
  buttonHover,
  float,
  pinShake,
  cardHover,
  cardTap,
  thumbnailZoom,
  slideIn,
  staggerContainer,
  staggerItem,
} satisfies Record<string, Variants>;

export type MotionPresetName = keyof typeof motionPresets;

export const reducedMotionPresets: Record<MotionPresetName, Variants> = {
  fadeIn,
  fadeInUp: reducedEntrance,
  buttonTap: reducedStatic,
  buttonHover: reducedStatic,
  // No floating loop: the element simply rests in place.
  float: { initial: {}, animate: {} },
  pinShake: { idle: {}, shake: {} },
  cardHover: reducedStatic,
  cardTap: reducedStatic,
  thumbnailZoom: reducedStatic,
  slideIn: reducedEntrance,
  staggerContainer: { initial: {}, animate: {} },
  staggerItem: reducedEntrance,
};

export function motionPreset(name: MotionPresetName, reduced: boolean): Variants {
  return reduced ? reducedMotionPresets[name] : motionPresets[name];
}
