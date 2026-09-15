import { useEffect, useState } from "react";
import { animate } from "framer-motion";
import { formatPz } from "@/lib/api";

/**
 * Contador animado (estilo Rare UI): interpola suavemente desde el valor
 * anterior hasta el nuevo, con easing y formato de miles.
 */
export default function AnimatedCounter({
  value = 0,
  duration = 0.9,
  className,
  format = formatPz,
  prefix = "",
  suffix = "",
}) {
  const [display, setDisplay] = useState(() => format(Number(value) || 0));

  useEffect(() => {
    const from = Number(display?.replace?.(/\D/g, "") || 0);
    const to = Number(value) || 0;
    if (from === to) return;
    const controls = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(format(Math.round(v))),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, format]);

  return (
    <span className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
