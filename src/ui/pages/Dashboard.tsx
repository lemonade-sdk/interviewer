import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, Clock, Award, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Interview, InterviewType } from '../../types';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { interviews, jobs, loadInterviews, loadJobs } = useStore();
  const [showNewInterviewModal, setShowNewInterviewModal] = useState(false);

  useEffect(() => {
    loadInterviews();
    loadJobs();
  }, []);

  const recentInterviews = interviews.slice(0, 5);
  const completedInterviews = interviews.filter(i => i.status === 'completed');
  const averageScore = completedInterviews.length > 0
    ? Math.round(
        completedInterviews.reduce((sum, i) => sum + (i.feedback?.overallScore || 0), 0) /
          completedInterviews.length
      )
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-lemonade-bg">
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Ready to practice?</p>
          </div>
          <button
            onClick={() => setShowNewInterviewModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-lemonade-accent text-black rounded-full hover:bg-lemonade-accent-hover transition-all shadow-md hover:shadow-lg font-bold"
          >
            <Plus size={20} />
            New Interview
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard
            icon={<MessageSquare size={24} />}
            label="Total Interviews"
            value={interviews.length}
            color="yellow"
          />
          <StatCard
            icon={<Award size={24} />}
            label="Average Score"
            value={averageScore}
            suffix="%"
            color="green"
          />
          <StatCard
            icon={<TrendingUp size={24} />}
            label="Active Applications"
            value={jobs.filter(j => j.status === 'interviewing').length}
            color="blue"
          />
        </div>

        {/* Recent Interviews */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={20} className="text-lemonade-accent-hover" />
            Recent Interviews
          </h2>
          {recentInterviews.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">No interviews yet. Start your first one!</p>
              <button
                onClick={() => setShowNewInterviewModal(true)}
                className="px-6 py-2 bg-lemonade-accent text-black rounded-full hover:bg-lemonade-accent-hover transition-colors font-bold"
              >
                Start Interview
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInterviews.map(interview => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  onClick={() => navigate(`/interview/${interview.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewInterviewModal && (
        <NewInterviewModal onClose={() => setShowNewInterviewModal(false)} />
      )}
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  color: 'yellow' | 'green' | 'blue';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, suffix = '', color }) => {
  const colorClasses = {
    yellow: 'bg-lemonade-accent/20 text-lemonade-accent-hover',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200 p-6 transition-transform hover:scale-[1.02]">
      <div className={`inline-flex p-3 rounded-xl ${colorClasses[color]} mb-3`}>
        {icon}
      </div>
      <p className="text-gray-600 text-sm font-medium">{label}</p>
      <p className="text-3xl font-extrabold text-gray-900 mt-1">
        {value}
        {suffix}
      </p>
    </div>
  );
};

interface InterviewCardProps {
  interview: Interview;
  onClick: () => void;
}

const InterviewCard: React.FC<InterviewCardProps> = ({ interview, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 border border-gray-100 bg-white rounded-xl hover:border-lemonade-accent hover:shadow-md cursor-pointer transition-all duration-200 group"
    >
      <div className="flex-1">
        <h3 className="font-bold text-gray-900 group-hover:text-lemonade-accent-hover transition-colors">{interview.title}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {interview.company} • {interview.position}
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {format(new Date(interview.startedAt), 'MMM d, yyyy')}
          </span>
          <span className="capitalize px-2 py-0.5 bg-gray-100 rounded-full">{interview.interviewType}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {interview.feedback && (
          <div className="text-right">
            <div className="text-2xl font-bold text-lemonade-accent-hover">
              {interview.feedback.overallScore}%
            </div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
        )}
        <StatusBadge status={interview.status} />
      </div>
    </div>
  );
};

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const colors = {
    completed: 'bg-green-100 text-green-800 border-green-200',
    'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
    scheduled: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[status as keyof typeof colors]}`}>
      {status.replace('-', ' ')}
    </span>
  );
};

interface NewInterviewModalProps {
  onClose: () => void;
}

const NewInterviewModal: React.FC<NewInterviewModalProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    position: '',
    interviewType: 'general' as InterviewType,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const interview = await window.electronAPI.startInterview(formData);
      navigate(`/interview/${interview.id}`);
    } catch (error) {
      console.error('Failed to start interview:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-lemonade-accent">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Plus className="text-lemonade-accent-hover" />
          Start New Interview
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Interview Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lemonade-accent focus:border-transparent transition-all"
              placeholder="e.g., Senior Software Engineer Interview"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Company</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lemonade-accent focus:border-transparent transition-all"
              placeholder="e.g., Tech Corp"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Position</label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lemonade-accent focus:border-transparent transition-all"
              placeholder="e.g., Senior Software Engineer"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Interview Type
            </label>
            <select
              value={formData.interviewType}
              onChange={(e) =>
                setFormData({ ...formData, interviewType: e.target.value as InterviewType })
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-lemonade-accent focus:border-transparent transition-all"
            >
              <option value="general">General</option>
              <option value="technical">Technical</option>
              <option value="behavioral">Behavioral</option>
              <option value="system-design">System Design</option>
              <option value="coding">Coding</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-lemonade-accent text-black font-bold rounded-xl hover:bg-lemonade-accent-hover hover:shadow-lg transition-all"
            >
              Start Interview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;
