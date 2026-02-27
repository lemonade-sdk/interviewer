import React from 'react';
import { cn } from '@ui/lib';

interface LemonBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';
  className?: string;
}

export const LemonBadge: React.FC<LemonBadgeProps> = ({
  children,
  variant = 'default',
  className,
}) => {
  const variants = {
    default: 'bg-lemonade-accent/20 text-lemonade-accent-hover',
    success: 'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
    warning: 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
    error: 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400',
    info: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400',
    outline: 'border border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/50',
  };

  return (
    <span
      className={cn(
        'text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wide inline-flex items-center justify-center transition-colors',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
