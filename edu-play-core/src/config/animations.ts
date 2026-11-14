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

const wobble: Variants = {
  hover: {
    rotate: [-2, 2, -2, 2, 0],
    transition: { duration: 0.4 },
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

// PIN dot animation
const pinDotFill: Variants = {
  empty: {
    opacity: 0.72,
    backgroundColor: 'var(--color-surface-container)',
    transition: transitions.smooth,
  },
  filled: {
    opacity: 1,
    backgroundColor: 'var(--color-tertiary-container)',
    transition: transitions.smooth,
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

// Celebration animation
const celebration: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
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

// Subtle mascot breathing loop without scale.
const breathe: Variants = {
  initial: { y: 0 },
  animate: {
    y: [-1, 1, -1],
    transition: { repeat: Infinity, duration: 2, ease: 'easeInOut' },
  },
};

// Reward reveal animation
const rewardReveal: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: transitions.smooth,
  },
};
