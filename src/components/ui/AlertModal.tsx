import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
};

export const AlertModal: React.FC<ModalProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-6 h-6 text-[#3ecf8e]" />;
      case 'error': return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'warning': return <AlertCircle className="w-6 h-6 text-amber-500" />;
      default: return <AlertCircle className="w-6 h-6 text-blue-500" />;
    }
  };

  const getAccentColor = () => {
    switch (type) {
      case 'success': return '#3ecf8e';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#3b82f6';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
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
            <div className="h-1 w-full" style={{ backgroundColor: getAccentColor() }} />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="mt-1">{getIcon()}</div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-[#ededed] tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm text-[#a1a1a1] leading-relaxed">{message}</p>
                </div>
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-[#2e2e2e] rounded-lg transition-colors text-[#a1a1a1]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-[#2e2e2e] hover:bg-[#3e3e3e] text-[#ededed] text-sm font-bold rounded-xl transition-all active:scale-95"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
