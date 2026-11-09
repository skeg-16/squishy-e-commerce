import { useEffect } from 'react';

export function AdminDialog({ dialog, onClose }) {
  useEffect(() => {
    if (!dialog) return;

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, onClose]);

  if (!dialog) return null;

  return (
    <div
      className="ad-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="ad-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ad-dialog-title"
      >
        <div className="ad-dialog__box">
          <header className="ad-dialog__head">
            <h2 id="ad-dialog-title">{dialog.title}</h2>

            <button
              type="button"
              className="ad-icon-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ×
            </button>
          </header>

          <div className="ad-dialog__body">
            {dialog.content}
          </div>
        </div>
      </section>
    </div>
  );
}

export function AdminToast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(onDismiss, 3500);

    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      className={`ad-toast ad-toast--${toast.type || 'success'}`}
      role="status"
    >
      <span>{toast.message}</span>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}
