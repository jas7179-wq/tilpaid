import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmWord = null, // If set, user must type this word to confirm
  confirmLabel = 'Confirm',
  danger = true,
}) {
  const [typed, setTyped] = useState('');

  if (!isOpen) return null;

  const canConfirm = confirmWord ? typed.toLowerCase() === confirmWord.toLowerCase() : true;

  const handleConfirm = () => {
    if (!canConfirm) return;
    setTyped('');
    onConfirm();
  };

  const handleClose = () => {
    setTyped('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6">
      <div className="bg-surface-card w-full max-w-sm rounded-2xl px-5 pt-5 pb-5 shadow-xl">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            danger ? 'bg-danger-50' : 'bg-warning-50'
          }`}>
            <AlertTriangle size={18} className={danger ? 'text-danger-500' : 'text-warning-500'} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">{message}</p>
          </div>
          <button onClick={handleClose} className="p-1 text-text-muted shrink-0">
            <X size={16} />
          </button>
        </div>

        {confirmWord && (
          <div className="mb-4 mt-3">
            <p className="text-xs text-text-secondary mb-1.5">
              Type <span className="font-semibold text-danger-500">{confirmWord}</span> to confirm
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              autoFocus
              className="w-full px-3 py-2.5 rounded-[10px] border border-border bg-surface text-sm focus:outline-none focus:border-danger-500 focus:ring-1 focus:ring-danger-500 box-border"
            />
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={handleClose}
            className="flex-1 py-2.5 rounded-[10px] border border-border text-sm font-medium text-text-secondary">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!canConfirm}
            className={`flex-1 py-2.5 rounded-[10px] text-sm font-medium text-white disabled:opacity-30 transition-opacity ${
              danger ? 'bg-danger-500' : 'bg-warning-500'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
