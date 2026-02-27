import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Award, BarChart3 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { LemonCard, InterviewCard } from '../components/lemon';

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
    <div className="h-full overflow-y-auto transition-colors duration-300">
      <div className="p-6 max-w-5xl mx-auto space-y-8 pb-16">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#cfcfcf]">
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
              Welcome back. You have {completedInterviews.length} completed interview{completedInterviews.length !== 1 ? 's' : ''}.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 px-6 py-2.5 bg-lemonade-accent text-black font-semibold rounded-xl hover:bg-lemonade-accent-hover transition-colors duration-200 active:scale-[0.98]"
          >
            <Plus size={16} />
            New Interview
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-5">
          <StatCard
            icon={<MessageSquare size={20} />}
            label="Total Interviews"
            value={interviews.length}
          />
          <StatCard
            icon={<Award size={20} />}
            label="Average Score"
            value={`${averageScore}%`}
            highlight
          />
          <StatCard
            icon={<BarChart3 size={20} />}
            label="In Progress"
            value={inProgressInterviews.length}
          />
        </div>

        {/* In Progress Interviews */}
        {inProgressInterviews.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 px-1">
              In Progress
            </h2>
            <div className="space-y-2">
              {inProgressInterviews.map(interview => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  onClick={() => navigate(`/interview/${interview.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Recent Interviews */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 px-1">
            Recent Activity
          </h2>
          
          <LemonCard noPadding>
            {recentInterviews.length === 0 ? (
              <div className="text-center py-16">
                <MessageSquare size={32} className="mx-auto text-gray-300 dark:text-white/15 mb-4" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white/80">No interviews yet</h3>
                <p className="text-sm text-gray-500 dark:text-white/40 mt-1 mb-6 max-w-xs mx-auto">
                  Start your first AI-powered interview to get detailed feedback.
                </p>
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-2.5 bg-lemonade-accent text-black font-semibold rounded-xl hover:bg-lemonade-accent-hover transition-colors"
                >
                  Start Interview
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100/60 dark:divide-white/[0.04]">
                {recentInterviews.map(interview => (
                  <InterviewCard
                    key={interview.id}
                    interview={interview}
                    className="rounded-none border-none hover:bg-lemonade-bg/60 dark:hover:bg-white/[0.03]"
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
          </LemonCard>
        </section>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, highlight = false }) => {
  return (
    <LemonCard className={highlight ? 'bg-lemonade-accent border-lemonade-accent text-black' : ''}>
      <div className="flex items-center gap-4">
        <div className={highlight ? 'text-black/60' : 'w-10 h-10 rounded-xl bg-lemonade-accent/10 flex items-center justify-center text-lemonade-accent-hover'}>
          {highlight ? icon : <div className="flex items-center justify-center">{icon}</div>}
        </div>
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider ${
            highlight ? 'text-black/50' : 'text-gray-400 dark:text-white/30'
          }`}>
            {label}
          </p>
          <p className="text-2xl font-bold mt-0.5">
            {value}
          </p>
        </div>
      </div>
    </LemonCard>
  );
};

export default Dashboard;
