import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Campana de notificaciones (estilo Rare UI): icono con indicador de
 * no leídos y panel desplegable animado.
 */
export default function NotificationBell({ notifications = [], className }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className={cn("relative", className)}>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-brand/15 bg-white text-brand transition-colors hover:bg-brand/5"
        aria-label="Notificaciones"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-brand/10 bg-white shadow-xl shadow-brand/10"
            >
              <div className="border-b border-brand/10 px-4 py-3 text-sm font-bold text-brand-dark">
                Notificaciones
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-brand-dark/50">
                    No tienes avisos por ahora.
                  </p>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={i}
                      className={cn(
                        "border-b border-brand/5 px-4 py-3 text-sm",
                        !n.read && "bg-brand/[0.03]"
                      )}
                    >
                      <p className="font-semibold text-brand-dark">{n.title}</p>
                      <p className="mt-0.5 text-xs text-brand-dark/55">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
