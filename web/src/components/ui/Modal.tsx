import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className={`w-full ${maxWidthStyles[maxWidth]} bg-surface-vanilla border-2 border-ink-black rounded-xl shadow-[6px_6px_0px_#18181B] overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-space-md py-space-sm border-b-2 border-ink-black bg-surface-vanilla-strong">
          <h3 className="font-title-sm text-ink-black font-bold text-base">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-ink-black hover:bg-ink-black/10 focus:outline-none"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-space-md overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-space-md py-space-sm border-t-2 border-ink-black bg-surface-vanilla-strong/50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
