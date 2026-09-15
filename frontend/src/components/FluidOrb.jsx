import { motion } from "framer-motion";

// Fluid Orb — orbe fluido animado (estética Rare UI). Una mancha que se
// deforma suavemente en bucle, usando Framer Motion.
export default function FluidOrb({ size = 220, className = "", style = {} }) {
  return (
    <motion.div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "42% 58% 60% 40% / 45% 45% 55% 55%",
        background:
          "linear-gradient(135deg, #7B3DFF 0%, #4D00FF 45%, #A678FF 100%)",
        filter: "blur(2px)",
        boxShadow: "0 20px 60px rgba(77,0,255,.45)",
        ...style,
      }}
      animate={{
        borderRadius: [
          "42% 58% 60% 40% / 45% 45% 55% 55%",
          "60% 40% 45% 55% / 55% 60% 40% 45%",
          "45% 55% 50% 50% / 60% 40% 55% 45%",
          "42% 58% 60% 40% / 45% 45% 55% 55%",
        ],
        rotate: [0, 8, -6, 0],
      }}
      transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
