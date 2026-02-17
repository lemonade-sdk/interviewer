import React from 'react';
import { cn } from '@ui/lib';

interface LemonSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const LemonSwitch: React.FC<LemonSwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}) => {
  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lemonade-accent/50 focus-visible:ring-offset-2',
        'dark:focus-visible:ring-offset-lemonade-dark-bg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-lemonade-accent' : 'bg-gray-300 dark:bg-white/20',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  );
};
