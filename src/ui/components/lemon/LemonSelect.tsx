import React from 'react';
import { cn } from '@ui/lib';

export interface LemonSelectOption {
  value: string;
  label: string;
}

interface LemonSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: LemonSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const LemonSelect: React.FC<LemonSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
}) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'appearance-none w-full px-3 py-2 text-sm rounded-lg border border-gray-200/60',
        'bg-white dark:bg-white/[0.06] dark:border-white/10 dark:text-white',
        'bg-no-repeat bg-[length:16px_16px] bg-[right_0.75rem_center]',
        'bg-[url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http%3A//www.w3.org/2000/svg%27%20width%3D%2716%27%20height%3D%2716%27%20viewBox%3D%270%200%2024%2024%27%20fill%3D%27none%27%20stroke%3D%27%239ca3af%27%20stroke-width%3D%272%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%3E%3Cpath%20d%3D%27m6%209%206%206%206-6%27/%3E%3C/svg%3E")]',
        'pr-9 transition-all duration-200 outline-none',
        'focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/20',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
