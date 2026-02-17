import React from 'react';
import { cn } from '@ui/lib';

interface LemonSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

export const LemonSlider: React.FC<LemonSliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className,
}) => {
  return (
    <input
      type="range"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className={cn(
        'lemon-slider w-full h-1.5 rounded-full appearance-none cursor-pointer',
        'bg-gray-200 outline-none transition-all',
        'focus-visible:ring-2 focus-visible:ring-lemonade-accent/30 focus-visible:ring-offset-2 focus-visible:rounded-full',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    />
  );
};
