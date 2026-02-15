import { useToastStore } from "../../stores/toastStore";

const TYPE_STYLES: Record<string, string> = {
  info: "border-info/30 text-info",
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  error: "border-error/30 text-error",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-14 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`animate-slide-in-right rounded-xl border bg-bg-secondary px-4 py-3 text-sm shadow-2xl shadow-black/20 ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
        >
          <div className="flex items-center gap-2">
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 text-text-muted transition-colors hover:text-text"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
