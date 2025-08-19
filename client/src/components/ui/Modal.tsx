import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (open) {
      ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
      
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={onClose}
      />
      <div 
        role="dialog" 
        aria-modal="true" 
        aria-label={title}
        className="absolute inset-0 grid place-items-center p-4"
      >
        <div 
          ref={ref} 
          className="w-full max-w-md rounded-2xl border bg-surface shadow-modal"
        >
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-base font-semibold text-text">{title}</h2>
            <button 
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5" 
              onClick={onClose} 
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}