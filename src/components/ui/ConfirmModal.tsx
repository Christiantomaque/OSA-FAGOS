import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, X } from 'lucide-react';

type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning';
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  variant = 'primary'
}) => {
  const getAccentColor = () => {
    switch (variant) {
      case 'danger': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#3ecf8e';
    }
  };

  const getButtonBg = () => {
    switch (variant) {
      case 'danger': return 'bg-red-500 hover:bg-red-600';
      case 'warning': return 'bg-amber-500 hover:bg-amber-600';
      default: return 'bg-[#3ecf8e] hover:bg-[#34b27b]';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-sm bg-[#171717] border border-[#2e2e2e] rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="h-1.5 w-full" style={{ backgroundColor: getAccentColor() }} />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="mt-1 p-2 rounded-lg bg-[#1c1c1c] border border-[#2e2e2e]">
                  <HelpCircle className="w-5 h-5" style={{ color: getAccentColor() }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#ededed] tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm text-[#a1a1a1] leading-relaxed">{message}</p>
                </div>
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-[#2e2e2e] hover:bg-[#3e3e3e] text-[#ededed] text-sm font-bold rounded-xl transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`flex-1 px-4 py-2 ${getButtonBg()} text-black font-bold text-sm rounded-xl transition-all active:scale-95`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
