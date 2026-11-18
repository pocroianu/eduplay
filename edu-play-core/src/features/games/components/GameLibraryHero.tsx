'use client';

import { motion, useReducedMotion } from 'framer-motion';

import { fadeIn, buttonHover } from '@/config/animations';

import { GameChromeButton } from './GameChromeButton';

export function GameLibraryHero() {
  const reduceMotion = useReducedMotion();
  const pressMotion = reduceMotion ? undefined : { y: 1 };
  const hoverMotion = reduceMotion ? undefined : 'hover';

  return (
    <motion.section
      variants={fadeIn}
      initial="initial"
      animate="animate"
      className="relative flex min-h-[280px] items-center overflow-hidden rounded-xl bg-primary p-6 md:p-12"
    >
      <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-white/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-12 h-48 w-48 rounded-full bg-gold/30 blur-2xl" />

      <div className="relative z-10 max-w-lg space-y-4">
        <h1 className="font-headline text-3xl font-bold leading-tight text-white md:text-4xl">
          Inspiră mințile mici prin joc.
        </h1>
        <p className="font-body text-lg text-on-primary/90">
          Explorează peste 500 de activități interactive concepute special pentru programa școlară din România.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <motion.div variants={buttonHover} whileHover={hoverMotion} whileTap={pressMotion}>
            <GameChromeButton className="rounded-full bg-gold-soft px-6 py-3 font-bold text-gold-deep shadow-soft">
              Explorează Noutățile
            </GameChromeButton>
          </motion.div>

          <motion.div whileTap={pressMotion}>
            <GameChromeButton className="rounded-full border border-white/30 bg-white/20 px-6 py-3 font-bold text-white shadow-soft-sm transition-colors hover:bg-white/30">
              Ghid Pedagogic
            </GameChromeButton>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
