import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Entrada OTP (estilo Rare UI): celdas individuales con auto-avance,
 * pegado de código completo y navegación con flechas/borrado.
 */
export default function OtpInput({
  length = 5,
  value = "",
  onChange,
  autoFocus = true,
  disabled = false,
  className,
  inputClassName,
}) {
  const [digits, setDigits] = useState(() => Array.from({ length }, (_, i) => value[i] || ""));
  const refs = useRef([]);

  useEffect(() => {
    const next = Array.from({ length }, (_, i) => value[i] || "");
    setDigits(next);
  }, [value, length]);

  const commit = (next) => {
    setDigits(next);
    onChange?.(next.join(""));
  };

  const focus = (i) => {
    const el = refs.current[i];
    if (el) el.focus();
  };

  const handleChange = (i, raw) => {
    const clean = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    commit(next);
    if (clean && i < length - 1) focus(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        const next = [...digits];
        next[i] = "";
        commit(next);
      } else if (i > 0) {
        focus(i - 1);
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    const next = Array.from({ length }, (_, i) => text[i] || "");
    commit(next);
    focus(Math.min(text.length, length - 1));
  };

  return (
    <div className={cn("flex items-center gap-2", className)} onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={d}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-11 rounded-xl border-2 border-brand/20 bg-white text-center text-xl font-extrabold text-brand-dark outline-none transition-all",
            "focus:border-brand focus:ring-4 focus:ring-brand/10",
            "disabled:cursor-not-allowed disabled:opacity-50",
            inputClassName
          )}
        />
      ))}
    </div>
  );
}
