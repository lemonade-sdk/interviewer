import React from 'react';
import { format } from 'date-fns';
import { Clock, Briefcase, ChevronRight } from 'lucide-react';
import { Interview } from '../../../types';
import { LemonBadge } from './LemonBadge';
import { cn } from '@ui/lib';

interface InterviewCardProps {
  interview: Interview;
  onClick: () => void;
  className?: string;
}

export const InterviewCard: React.FC<InterviewCardProps> = ({
  interview,
  onClick,
  className,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-lemonade-accent-hover';
    return 'text-red-600 dark:text-red-400';
  };

  const getStatusVariant = (status: string): 'success' | 'default' | 'outline' => {
    if (status === 'completed') return 'success';
    if (status === 'in-progress') return 'default';
    return 'outline';
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center justify-between p-6 rounded-2xl',
        'border border-transparent hover:border-gray-200/60 dark:hover:border-white/5',
        'hover:bg-lemonade-bg dark:hover:bg-white/[0.03]',
        'cursor-pointer transition-all duration-200',
        className
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-lemonade-accent/10 flex items-center justify-center text-lemonade-accent-hover shrink-0">
          <Briefcase size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white/90 truncate group-hover:text-lemonade-accent-hover transition-colors">
              {interview.title}
            </h3>
            <LemonBadge variant={getStatusVariant(interview.status)}>
              {interview.status.replace('-', ' ')}
            </LemonBadge>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-white/40 mt-1">
            {interview.company} &middot; {interview.position}
          </p>
          
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 dark:text-white/30">
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              {format(new Date(interview.startedAt), 'MMM d, yyyy')}
            </span>
            <span className="px-2.5 py-1 bg-gray-100 dark:bg-white/5 rounded text-xs">
              {interview.interviewType}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 pl-4">
        {interview.status === 'completed' && interview.feedback && (
          <span className={cn('text-xl font-bold', getScoreColor(interview.feedback.overallScore))}>
            {interview.feedback.overallScore}%
          </span>
        )}
        <ChevronRight size={18} className="text-gray-300 dark:text-white/10 group-hover:text-lemonade-accent-hover transition-colors" />
      </div>
    </div>
  );
};
