import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@ui/lib';

interface LemonDialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const LemonDialog: React.FC<LemonDialogProps> = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  className,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      // Focus the content container for accessibility
      requestAnimationFrame(() => contentRef.current?.focus());
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Content */}
      <div
        ref={contentRef}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full bg-white dark:bg-lemonade-dark-surface rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10',
          'mx-4 transition-all duration-200',
          'outline-none',
          className
        )}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-gray-100 dark:border-white/10">
            <div>
              {title && (
                <h2 className="text-lg font-semibold leading-tight dark:text-white">{title}</h2>
              )}
              {subtitle && (
                <div className="mt-0.5 dark:text-white/60">{subtitle}</div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors -mt-1 -mr-1"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={cn(!title && !subtitle && 'pt-5')}>
          {/* Close button when no header */}
          {!title && !subtitle && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 dark:text-white/40 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors z-10"
            >
              <X size={18} />
            </button>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
