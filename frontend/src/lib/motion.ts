import type { Transition, Variants } from "framer-motion";

const cardSpring: Transition = {
  type: "spring",
  stiffness: 120,
  damping: 12,
};

export const cardSlideLeft: Variants = {
  hidden: { x: -80, opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: cardSpring,
  },
};

export const cardSlideRight: Variants = {
  hidden: { x: 80, opacity: 0 },
  show: {
    x: 0,
    opacity: 1,
    transition: { ...cardSpring, delay: 0.1 },
  },
};
