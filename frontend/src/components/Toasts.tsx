import { AnimatePresence, motion } from "framer-motion";

export type Toast = {
  id: string;
  text: string;
};

type ToastsProps = {
  toasts: Toast[];
};

export function Toasts({ toasts }: ToastsProps) {
  return (
    <div className="toasts" aria-live="polite" role="status">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className="toast"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            {toast.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
