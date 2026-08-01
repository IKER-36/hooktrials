import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteTransitionProps {
  children: ReactNode;
}

/**
 * Keeps route changes legible without making the dashboard feel animated for
 * its own sake. Motion owns the transition; the reduced-motion preference is
 * respected before any transform is applied.
 */
export function RouteTransition({ children }: RouteTransitionProps) {
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const reduced = prefersReducedMotion ?? false;

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={location.pathname}
        className="ht-route-transition"
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -4 }}
        transition={reduced ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
