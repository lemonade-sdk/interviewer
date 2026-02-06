import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Award, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Interview, InterviewType } from '../../types';
import { format } from 'date-fns';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { interviews, loadInterviews } = useStore();
  const [showNewInterviewModal, setShowNewInterviewModal] = useState(false);

  useEffect(() => {
    loadInterviews();
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
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-black">dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">welcome back</p>
          </div>
          <button
            onClick={() => setShowNewInterviewModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-lemonade-accent text-black rounded-full hover:bg-lemonade-accent-hover transition-all font-semibold text-sm"
          >
            <Plus size={16} />
            new interview
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-5 mb-10">
          <StatCard
            icon={<MessageSquare size={20} />}
            label="total interviews"
            value={interviews.length}
          />
          <StatCard
            icon={<Award size={20} />}
            label="average score"
            value={averageScore}
            suffix="%"
          />
        </div>

        {/* Recent Interviews */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-black mb-4 tracking-wide">
            recent interviews
          </h2>
          {recentInterviews.length === 0 ? (
            <div className="text-center py-16">
              <MessageSquare size={36} className="mx-auto text-gray-300 mb-4" />
              <p className="text-sm text-gray-500 mb-5">no interviews yet</p>
              <button
                onClick={() => setShowNewInterviewModal(true)}
                className="px-6 py-2.5 bg-lemonade-accent text-black rounded-full hover:bg-lemonade-accent-hover transition-colors text-sm font-semibold"
              >
                start interview
              </button>
            </div>
          ) : (
            <div className="space-y-2">
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
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, suffix = '' }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-lemonade-accent/20 text-lemonade-accent-hover flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-black mt-0.5">
          {value}{suffix}
        </p>
      </div>
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
      className="flex items-center justify-between p-4 rounded-xl hover:bg-lemonade-bg cursor-pointer transition-colors group"
    >
      <div className="flex-1">
        <h3 className="font-semibold text-sm text-black group-hover:text-lemonade-accent-hover transition-colors">
          {interview.title}
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          {interview.company} &middot; {interview.position}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {format(new Date(interview.startedAt), 'MMM d, yyyy')}
          </span>
          <span className="px-2 py-0.5 bg-gray-100 rounded-full text-gray-500">
            {interview.interviewType}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {interview.feedback && (
          <span className="text-xl font-bold text-lemonade-accent-hover">
            {interview.feedback.overallScore}%
          </span>
        )}
        <StatusBadge status={interview.status} />
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    completed: 'bg-green-50 text-green-600',
    'in-progress': 'bg-blue-50 text-blue-600',
    scheduled: 'bg-yellow-50 text-yellow-700',
    cancelled: 'bg-gray-50 text-gray-500',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-50 text-gray-500'}`}>
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

  const inputClass =
    'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lemonade-accent focus:border-transparent transition-all';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-7 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-bold text-black mb-5 tracking-wide">start new interview</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={inputClass}
              placeholder="e.g., senior software engineer interview"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">company</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className={inputClass}
              placeholder="e.g., tech corp"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">position</label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              className={inputClass}
              placeholder="e.g., senior software engineer"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">type</label>
            <select
              value={formData.interviewType}
              onChange={(e) =>
                setFormData({ ...formData, interviewType: e.target.value as InterviewType })
              }
              className={inputClass}
            >
              <option value="general">general</option>
              <option value="technical">technical</option>
              <option value="behavioral">behavioral</option>
              <option value="system-design">system design</option>
              <option value="coding">coding</option>
              <option value="mixed">mixed</option>
            </select>
          </div>
          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all"
            >
              cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-lemonade-accent text-black font-semibold text-sm rounded-xl hover:bg-lemonade-accent-hover transition-all"
            >
              start interview
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;
