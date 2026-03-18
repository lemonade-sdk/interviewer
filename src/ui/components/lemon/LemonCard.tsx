import React from 'react';
import { cn } from '@ui/lib';

interface LemonCardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  noPadding?: boolean;
  hoverable?: boolean;
  onClick?: () => void;
}

export const LemonCard: React.FC<LemonCardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  className,
  contentClassName,
  noPadding = false,
  hoverable = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl overflow-hidden transition-all duration-200',
        hoverable && 'hover:shadow-lg hover:shadow-black/[0.03] dark:hover:shadow-none hover:-translate-y-0.5 cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
    >
      {(title || subtitle || headerAction) && (
        <div className="px-8 py-5 border-b border-gray-100/60 dark:border-white/[0.04] flex items-center justify-between">
          <div className="flex-1 pr-4">
            {title && (
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className={cn(
        !noPadding && 'p-8',
        contentClassName
      )}>
        {children}
      </div>

      {footer && (
        <div className="px-8 py-5 border-t border-gray-100/60 dark:border-white/[0.04]">
          {footer}
        </div>
      )}
    </div>
  );
};
