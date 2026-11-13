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
      className="adm-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="adm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="adm-dialog-title"
      >
        <div className="adm-dialog__box">
          <header className="adm-dialog__head">
            <h2 id="adm-dialog-title">{dialog.title}</h2>

            <button
              type="button"
              className="adm-icon-btn"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ×
            </button>
          </header>

          <div className="adm-dialog__body">
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

  const isError = toast.type === 'error' || toast.type === true;

  return (
    <div
      className={`adm-toast is-visible ${isError ? 'is-error adm-toast--error' : 'adm-toast--success'}`}
      role={isError ? 'alert' : 'status'}
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
