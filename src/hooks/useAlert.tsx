import { useState, useCallback } from 'react';

export type ModalState = {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  onClose?: () => void;
};

export function useAlert() {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = useCallback((title: string, message: string, type: ModalState['type'] = 'info', onClose?: () => void) => {
    setModal({
      isOpen: true,
      title,
      message,
      type,
      onClose
    });
  }, []);

  const hideAlert = useCallback(() => {
    if (modal.onClose) modal.onClose();
    setModal(prev => ({ ...prev, isOpen: false }));
  }, [modal]);

  return { modal, showAlert, hideAlert };
}
