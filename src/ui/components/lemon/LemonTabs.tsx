import React, { useState, useCallback, type ReactNode } from 'react';
import { cn } from '@ui/lib';

export interface LemonTab {
  value: string;
  label: ReactNode;
  content: ReactNode;
}

interface LemonTabsProps {
  tabs: LemonTab[];
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  listClassName?: string;
  contentClassName?: string;
}

export const LemonTabs: React.FC<LemonTabsProps> = ({
  tabs,
  defaultValue,
  value: controlledValue,
  onValueChange,
  className,
  listClassName,
  contentClassName,
}) => {
  const [internalValue, setInternalValue] = useState(
    defaultValue || tabs[0]?.value || ''
  );

  const activeValue = controlledValue ?? internalValue;

  const handleTabClick = useCallback(
    (tabValue: string) => {
      if (!controlledValue) {
        setInternalValue(tabValue);
      }
      onValueChange?.(tabValue);
    },
    [controlledValue, onValueChange]
  );

  const activeTab = tabs.find((t) => t.value === activeValue);

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Tab List */}
      <div
        className={cn(
          'flex gap-1 border-b border-gray-200 dark:border-white/10 pb-px',
          listClassName
        )}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.value === activeValue;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.value)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-all duration-200 -mb-px border-b-2',
                isActive
                  ? 'border-lemonade-accent text-black dark:text-white'
                  : 'border-transparent text-gray-500 dark:text-white/50 hover:text-black dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab && (
        <div
          role="tabpanel"
          className={cn(contentClassName)}
        >
          {activeTab.content}
        </div>
      )}
    </div>
  );
};
