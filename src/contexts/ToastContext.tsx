import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast, ToastType, ToastContainer } from '../components/common/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  confirm: (message: string) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmResolver, setConfirmResolver] = useState<((value: boolean) => void) | null>(null);
  const [confirmMessage, setConfirmMessage] = useState<string>('');

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message: string, duration = 4000) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const error = useCallback((message: string, duration = 5000) => {
    showToast(message, 'error', duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration = 4000) => {
    showToast(message, 'warning', duration);
  }, [showToast]);

  const info = useCallback((message: string, duration = 4000) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmMessage(message);
      setConfirmResolver(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback((result: boolean) => {
    if (confirmResolver) {
      confirmResolver(result);
      setConfirmResolver(null);
      setConfirmMessage('');
    }
  }, [confirmResolver]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, confirm }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Confirm Modal */}
      {confirmMessage && (
        <div className="modal-overlay" onClick={() => handleConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Onay</h2>
            </div>
            <div className="modal-body">
              <p>{confirmMessage}</p>
            </div>
            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => handleConfirm(false)}
              >
                İptal
              </button>
              <button
                className="primary-button"
                onClick={() => handleConfirm(true)}
              >
                Onayla
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
