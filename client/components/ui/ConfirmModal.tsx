import { Modal } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      className="glass-modal-surface max-w-md p-5 shadow-2xl"
      ariaLabelledBy="confirm-delete-title"
    >
      <h3 id="confirm-delete-title" className="text-foreground text-base font-semibold">
        {title}
      </h3>
      <p className="text-muted mt-2 text-sm">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="border-glass-border text-muted hover:border-glass-border-hover hover:text-foreground rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="border-danger/50 bg-danger/10 text-danger hover:bg-danger/20 rounded-lg border px-3 py-1.5 text-sm transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
