import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Eye, Clock, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Interview } from '../../types';
import { format } from 'date-fns';
import { LemonTabs } from '../components/lemon/LemonTabs';
import { LemonDialog } from '../components/lemon/LemonDialog';
import { LemonSelect } from '../components/lemon/LemonSelect';

const InterviewHistory: React.FC = () => {
  const navigate = useNavigate();
  const { interviews, loadInterviews } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);

  useEffect(() => {
    loadInterviews();
  }, []);

  const filteredInterviews = interviews.filter((interview) => {
    const matchesSearch =
      interview.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      interview.position.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || interview.interviewType === filterType;
    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (interviewId: string) => {
    const confirmed = window.confirm('Delete this interview? This action cannot be undone.');
    if (confirmed) {
      try {
        await window.electronAPI.deleteInterview(interviewId);
        loadInterviews();
      } catch (error) {
        console.error('Failed to delete interview:', error);
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-lemonade-accent-hover';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="h-full overflow-y-auto bg-lemonade-bg dark:bg-lemonade-dark-bg transition-colors duration-300">
      <div className="px-16 py-12 max-w-7xl mx-auto space-y-12 pb-20">
        <div>
          <h1 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-[#cfcfcf]">History</h1>
          <p className="text-lg text-gray-500 dark:text-white/40 mt-4">Review your past interviews</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-3xl p-10 flex gap-6 items-center transition-colors duration-300">
          <div className="flex-1 relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30" size={22} />
            <input
              type="text"
              placeholder="Search interviews..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/20 focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none"
            />
          </div>
          <LemonSelect
            value={filterType}
            onChange={setFilterType}
            className="w-48"
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'technical', label: 'Technical' },
              { value: 'behavioral', label: 'Behavioral' },
              { value: 'system-design', label: 'System Design' },
              { value: 'coding', label: 'Coding' },
              { value: 'general', label: 'General' },
              { value: 'mixed', label: 'Mixed' },
            ]}
          />
        </div>

        {/* Interviews List */}
        <div className="space-y-6">
          {filteredInterviews.length === 0 ? (
            <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-3xl p-16 text-center transition-colors duration-300">
              <MessageSquare size={48} className="mx-auto text-gray-300 dark:text-white/15 mb-6" />
              <p className="text-lg text-gray-500 dark:text-white/40">No interviews found matching your criteria.</p>
            </div>
          ) : (
            filteredInterviews.map((interview) => (
              <div key={interview.id} className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-3xl p-10 hover:border-gray-300/60 dark:hover:border-white/10 transition-all duration-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate text-gray-900 dark:text-white/90">{interview.title}</h3>
                    <p className="text-base text-gray-500 dark:text-white/40 mt-2">
                      {interview.company} &middot; {interview.position}
                    </p>
                    <div className="flex items-center gap-6 mt-4 text-base text-gray-400 dark:text-white/30">
                      <span className="text-sm px-4 py-2 border border-gray-200/50 dark:border-white/[0.08] rounded-full">
                        {interview.interviewType}
                      </span>
                      <span className="flex items-center gap-2">
                        <Clock size={20} />
                        {format(new Date(interview.startedAt), 'MMMM d, yyyy')}
                      </span>
                      {interview.duration && (
                        <span className="flex items-center gap-2">
                          <MessageSquare size={20} />
                          {Math.round(interview.duration / 60)} min
                        </span>
                      )}
                    </div>
                    {interview.feedback && (
                      <div className="mt-6 flex items-center gap-6">
                        <span className={`text-3xl font-bold ${getScoreColor(interview.feedback.overallScore)}`}>
                          {interview.feedback.overallScore}%
                        </span>
                        <p className="text-base text-gray-500 dark:text-white/40 line-clamp-1 flex-1">
                          {interview.feedback.detailedFeedback}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-4 ml-6">
                    <button
                      onClick={() => setSelectedInterview(interview)}
                      title="View Details"
                      className="p-4 rounded-xl text-gray-400 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={() => handleDelete(interview.id)}
                      title="Delete"
                      className="p-4 rounded-xl text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Dialog */}
      <LemonDialog
        open={!!selectedInterview}
        onClose={() => setSelectedInterview(null)}
        title={selectedInterview?.title}
        subtitle={
          selectedInterview && (
            <p className="text-lg text-gray-500 dark:text-white/40">
              {selectedInterview.company} &middot; {selectedInterview.position}
            </p>
          )
        }
        className="max-w-4xl max-h-[85vh] flex flex-col"
      >
        {selectedInterview && (
          <LemonTabs
            defaultValue="feedback"
            className="flex-1 overflow-hidden flex flex-col"
            listClassName="px-10 pt-2"
            contentClassName="flex-1 overflow-y-auto mt-4 px-10 pb-10"
            tabs={[
              {
                value: 'feedback',
                label: 'Feedback',
                content: selectedInterview.feedback ? (
                  <div className="space-y-8">
                    <div className="flex items-center gap-6">
                      <span className={`text-5xl font-bold ${getScoreColor(selectedInterview.feedback.overallScore)}`}>
                        {selectedInterview.feedback.overallScore}%
                      </span>
                      <span className="text-lg text-gray-500 dark:text-white/40">Overall Score</span>
                    </div>

                    {selectedInterview.feedback.strengths.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium uppercase tracking-wider text-gray-400 dark:text-white/30 mb-6">Strengths</h4>
                        <ul className="space-y-3">
                          {selectedInterview.feedback.strengths.map((s, i) => (
                            <li key={i} className="text-base flex items-start gap-3">
                              <span className="text-green-500 dark:text-green-400 mt-0.5">+</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedInterview.feedback.weaknesses.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium uppercase tracking-wider text-gray-400 dark:text-white/30 mb-6">Areas for Improvement</h4>
                        <ul className="space-y-3">
                          {selectedInterview.feedback.weaknesses.map((w, i) => (
                            <li key={i} className="text-base flex items-start gap-3">
                              <span className="text-yellow-500 dark:text-yellow-400 mt-0.5">!</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {selectedInterview.feedback.suggestions.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium uppercase tracking-wider text-gray-400 dark:text-white/30 mb-6">Suggestions</h4>
                        <ul className="space-y-3">
                          {selectedInterview.feedback.suggestions.map((s, i) => (
                            <li key={i} className="text-base flex items-start gap-3">
                              <span className="text-lemonade-accent-hover mt-0.5">&rarr;</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="border-t border-gray-100/60 dark:border-white/[0.04] my-8" />

                    <div>
                      <h4 className="text-sm font-medium uppercase tracking-wider text-gray-400 dark:text-white/30 mb-6">Detailed Feedback</h4>
                      <p className="text-base whitespace-pre-wrap leading-relaxed">
                        {selectedInterview.feedback.detailedFeedback}
                      </p>
                    </div>

                    {selectedInterview.feedback.questionFeedbacks &&
                     selectedInterview.feedback.questionFeedbacks.length > 0 && (
                      <button
                        onClick={() => {
                          setSelectedInterview(null);
                          navigate(`/feedback/${selectedInterview.id}`);
                        }}
                        className="flex items-center gap-4 px-8 py-5 bg-lemonade-accent text-black font-semibold text-base rounded-2xl hover:bg-lemonade-accent-hover transition-colors"
                      >
                        <Eye size={20} />
                        View Detailed Question Feedback
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-lg text-gray-500 dark:text-white/40 text-center py-12">
                    No feedback available for this interview.
                  </p>
                ),
              },
              {
                value: 'transcript',
                label: 'Transcript',
                content: (
                  <div className="space-y-6">
                    {selectedInterview.transcript
                      .filter((msg) => msg.role !== 'system')
                      .map((message) => (
                        <div
                          key={message.id}
                          className={`p-8 rounded-2xl text-base ${
                            message.role === 'user'
                              ? 'bg-lemonade-accent/10 ml-16'
                              : 'bg-lemonade-bg dark:bg-white/[0.03] mr-16'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-gray-500 dark:text-white/40">
                              {message.role === 'user' ? 'You' : 'Interviewer'}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-white/30">
                              {format(new Date(message.timestamp), 'h:mm a')}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        </div>
                      ))}
                  </div>
                ),
              },
            ]}
          />
        )}
      </LemonDialog>
    </div>
  );
};

export default InterviewHistory;
