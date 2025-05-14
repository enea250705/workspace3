import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

type AnimatedContainerProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  type?: "slide-up" | "fade" | "slide-in" | "scale";
};

/**
 * Componente contenitore animato che aggiunge animazioni di ingresso agli elementi
 * Utilizza framer-motion per animazioni fluide e performanti
 */
export function AnimatedContainer({
  children,
  className = "",
  delay = 0,
  type = "fade"
}: AnimatedContainerProps) {
  // Configurazioni di animazione predefinite
  const animations = {
    "fade": {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.4, delay }
    },
    "slide-up": {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 },
      transition: { duration: 0.4, delay }
    },
    "slide-in": {
      initial: { opacity: 0, x: -20 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -20 },
      transition: { duration: 0.4, delay }
    },
    "scale": {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.9 },
      transition: { duration: 0.4, delay }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className={className}
        {...animations[type]}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}