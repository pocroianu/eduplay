'use client';

import { motion } from 'framer-motion';

import { fadeIn, buttonHover, buttonTap } from '@/config/animations';
import { Icon } from '@/shared/components/ui/Icon';

import { GameChromeButton } from './GameChromeButton';

function PromotionalCard() {
  return (
    <motion.div
      variants={fadeIn}
      className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-gold-soft p-8 shadow-soft md:col-span-2 xl:col-span-2"
    >
      <div className="relative z-10 space-y-2">
        <span className="rounded-full bg-surface-container-lowest/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-secondary-fixed-variant">
          Resursă Premium
        </span>
        <h3 className="max-w-sm font-headline text-2xl font-bold leading-tight text-on-secondary-fixed md:text-3xl">
          Pachet Complet de Lecții: &quot;Geografia României&quot;
        </h3>
        <p className="max-w-xs font-medium text-on-secondary-fixed/80">
          Include 12 jocuri interactive, hărți 3D și teste de evaluare rapide.
        </p>
      </div>

      <div className="relative z-10 pt-6">
        <motion.div variants={{ ...buttonHover, ...buttonTap }} whileHover="hover" whileTap="tap">
          <GameChromeButton className="rounded-full bg-on-secondary-fixed px-8 py-3 font-bold text-white">
            Descarcă Pachetul
          </GameChromeButton>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 opacity-40">
        <Icon name="MapTrifold" size={200} className="text-white" />
      </div>
    </motion.div>
  );
}
