import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Award, MessageSquare, Play, BarChart3 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Interview } from '../../types';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { interviews, loadInterviews } = useStore();

  useEffect(() => {
    loadInterviews();
  }, []);

  const recentInterviews = interviews.slice(0, 5);
  const completedInterviews = interviews.filter(i => i.status === 'completed');
  const inProgressInterviews = interviews.filter(i => i.status === 'in-progress');
  const averageScore = completedInterviews.length > 0
    ? Math.round(
        completedInterviews.reduce((sum, i) => sum + (i.feedback?.overallScore || 0), 0) /
          completedInterviews.length
      )
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Welcome back</p>
          </div>
          <Button onClick={() => navigate('/')} className="gap-2 rounded-full">
            <Plus size={16} />
            New Interview
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Interviews</p>
                <p className="text-2xl font-bold mt-0.5">{interviews.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Award size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average Score</p>
                <p className="text-2xl font-bold mt-0.5">{averageScore}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <BarChart3 size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold mt-0.5">{inProgressInterviews.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* In Progress Interviews */}
        {inProgressInterviews.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {inProgressInterviews.map(interview => (
                <div
                  key={interview.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                  onClick={() => navigate(`/interview/${interview.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {interview.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {interview.company} &middot; {interview.position}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">in progress</Badge>
                    <Button variant="outline" size="xs" className="gap-1">
                      <Play size={10} />
                      Resume
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Interviews */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Interviews
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentInterviews.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare size={36} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-sm text-muted-foreground mb-5">No interviews yet</p>
                <Button onClick={() => navigate('/')} className="rounded-full">
                  Start Interview
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {recentInterviews.map(interview => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    onClick={() => {
                      if (interview.status === 'in-progress') {
                        navigate(`/interview/${interview.id}`);
                      } else if (interview.feedback) {
                        navigate(`/feedback/${interview.id}`);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface InterviewCardProps {
  interview: Interview;
  onClick: () => void;
}

const InterviewCard: React.FC<InterviewCardProps> = ({ interview, onClick }) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
          {interview.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {interview.company} &middot; {interview.position}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {format(new Date(interview.startedAt), 'MMM d, yyyy')}
          </span>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {interview.interviewType}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {interview.status === 'completed' && interview.feedback && (
          <span className={cn('text-xl font-bold', getScoreColor(interview.feedback.overallScore))}>
            {interview.feedback.overallScore}%
          </span>
        )}
        <StatusBadge status={interview.status} />
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const variant = status === 'completed' ? 'default' :
                  status === 'in-progress' ? 'secondary' :
                  'outline';

  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status.replace('-', ' ')}
    </Badge>
  );
};

export default Dashboard;
