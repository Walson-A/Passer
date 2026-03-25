import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  width?: "fit-content" | "100%";
  delay?: number;
  yOffset?: number;
  blur?: boolean;
  scale?: boolean;
}

export const Reveal = ({ 
  children, 
  width = "100%", 
  delay = 0.2, 
  yOffset = 75,
  blur = false,
  scale = false
}: RevealProps) => {
  return (
    <div style={{ position: "relative", width, overflow: "hidden" }}>
      <motion.div
        initial={{ 
          opacity: 0, 
          y: yOffset,
          filter: blur ? "blur(12px)" : "blur(0px)",
          scale: scale ? 1.05 : 1
        }}
        whileInView={{ 
          opacity: 1, 
          y: 0,
          filter: "blur(0px)",
          scale: 1
        }}
        transition={{ 
          duration: 1.2, 
          ease: [0.16, 1, 0.3, 1], 
          delay 
        }}
        viewport={{ once: true }}
      >
        {children}
      </motion.div>
    </div>
  );
};
