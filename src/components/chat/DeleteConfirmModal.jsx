import { useEffect } from "react";
import { Trash2, X, Loader2 } from "lucide-react";

export default function DeleteConfirmModal({
  isOpen,
  title = "Delete Chat?",
  description,
  conversationTitle = "this chat",
  confirmText = "Delete Chat",
  onConfirm,
  onCancel,
  isDeleting = false,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, isDeleting]);

  if (!isOpen) return null;

  return (
    <div
      className="confirm-modal-overlay"
      onClick={isDeleting ? undefined : onCancel}
      role="presentation"
    >
      <div
        className="confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-modal-title"
      >
        <button
          className="confirm-modal-close-btn"
          onClick={onCancel}
          disabled={isDeleting}
          aria-label="Close dialog"
          type="button"
        >
          <X size={16} />
        </button>

        <div className="confirm-modal-icon-badge">
          <Trash2 size={24} />
        </div>

        <h3 id="delete-modal-title" className="confirm-modal-title">
          {title}
        </h3>

        <p className="confirm-modal-desc">
          {description ? (
            description
          ) : (
            <>
              Are you sure you want to delete <span className="confirm-modal-target-title">"{conversationTitle}"</span>? This will permanently remove all messages and data in this conversation thread.
            </>
          )}
        </p>

        <div className="confirm-modal-footer">
          <button
            type="button"
            className="confirm-modal-btn cancel"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm-modal-btn danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 size={15} className="spin-icon" />
                <span>Deleting…</span>
              </>
            ) : (
              <>
                <Trash2 size={15} />
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
