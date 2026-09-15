import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-brand/10 bg-white p-5 shadow-sm shadow-brand/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, subtitle, className }) {
  return (
    <div className={cn("mb-4", className)}>
      <h2 className="text-lg font-extrabold text-brand-dark">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-brand-dark/55">{subtitle}</p>}
    </div>
  );
}

export function Badge({ tone = "brand", className, children }) {
  const tones = {
    brand: "bg-brand/10 text-brand",
    green: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    rose: "bg-rose-500/10 text-rose-600",
    gray: "bg-slate-500/10 text-slate-500",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        tones[tone] || tones.brand,
        className
      )}
    >
      {children}
    </span>
  );
}

export function Button({ variant = "primary", className, loading, children, ...props }) {
  const variants = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    ghost: "bg-brand/5 text-brand hover:bg-brand/10",
    outline: "border border-brand/20 bg-white text-brand hover:bg-brand/5",
    danger: "bg-rose-500 text-white hover:bg-rose-600",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant] || variants.primary,
        className
      )}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </motion.button>
  );
}

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-xl bg-brand/10", className)} />;
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand/20 px-6 py-10 text-center">
      <p className="font-bold text-brand-dark">{title}</p>
      {hint && <p className="max-w-sm text-sm text-brand-dark/55">{hint}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <span
      className={cn(
        "inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand",
        className
      )}
    />
  );
}
