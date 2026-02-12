import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Award, MessageSquare, ChevronLeft } from 'lucide-react';
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
      if (!window.electronAPI) {
        console.warn('Electron API not available — cannot start interview in browser mode');
        onClose();
        return;
      }
      const interview = await window.electronAPI.startInterview(formData);
      navigate(`/interview/${interview.id}`);
    } catch (error) {
      console.error('Failed to start interview:', error);
    }
  };

  const inputClass =
    'w-full px-5 py-4 bg-gray-50/50 border border-gray-200/60 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-lemonade-accent focus:ring-4 focus:ring-lemonade-accent/10 transition-all duration-300 outline-none';
  const labelClass = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 ml-1';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-10 w-full max-w-lg shadow-2xl shadow-black/10 border border-white/20 ring-1 ring-black/5 animate-in zoom-in-95 duration-300">
        <h2 className="text-xl font-bold text-black mb-8 tracking-wide">Start New Interview</h2>
        <form onSubmit={handleSubmit} className="space-y-7">
          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={inputClass}
              placeholder="e.g., Senior Software Engineer Interview"
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelClass}>Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className={inputClass}
                placeholder="e.g., Tech Corp"
                required
              />
            </div>
            <div>
              <label className={labelClass}>Position</label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className={inputClass}
                placeholder="e.g., Senior Engineer"
                required
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Interview Type</label>
            <div className="relative">
              <select
                value={formData.interviewType}
                onChange={(e) =>
                  setFormData({ ...formData, interviewType: e.target.value as InterviewType })
                }
                className={`${inputClass} appearance-none cursor-pointer`}
              >
                <option value="general">General Interview</option>
                <option value="technical">Technical Assessment</option>
                <option value="behavioral">Behavioral Fit</option>
                <option value="system-design">System Design</option>
                <option value="coding">Live Coding</option>
                <option value="mixed">Mixed Format</option>
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronLeft className="rotate-[-90deg] w-4 h-4" />
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 border border-gray-200 text-gray-600 font-bold text-sm rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-4 bg-lemonade-accent text-black font-bold text-sm rounded-2xl hover:bg-lemonade-accent-hover hover:shadow-lg hover:shadow-lemonade-accent/20 transition-all duration-300 active:scale-[0.98]"
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
