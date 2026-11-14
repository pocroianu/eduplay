import type { Variants } from "framer-motion";

export const reducedFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

export const reducedStagger: Variants = {
  initial: {},
  animate: {},
};

export const reducedStaggerItem: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
};
