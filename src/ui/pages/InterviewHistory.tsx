import React, { useEffect, useState } from 'react';
import { Search, Filter, Trash2, Eye } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Interview } from '../../types';
import { format } from 'date-fns';

const InterviewHistory: React.FC = () => {
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
    
    const matchesFilter =
      filterType === 'all' || interview.interviewType === filterType;

    return matchesSearch && matchesFilter;
  });

  const handleDelete = async (interviewId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this interview? This action cannot be undone.'
    );

    if (confirmed) {
      try {
        await window.electronAPI.deleteInterview(interviewId);
        loadInterviews();
      } catch (error) {
        console.error('Failed to delete interview:', error);
      }
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Interview History</h1>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search interviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={20} className="text-gray-500" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Types</option>
                <option value="technical">Technical</option>
                <option value="behavioral">Behavioral</option>
                <option value="system-design">System Design</option>
                <option value="coding">Coding</option>
                <option value="general">General</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Interviews List */}
        <div className="space-y-4">
          {filteredInterviews.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-600">No interviews found matching your criteria.</p>
            </div>
          ) : (
            filteredInterviews.map((interview) => (
              <div
                key={interview.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {interview.title}
                    </h3>
                    <p className="text-gray-600 mt-1">
                      {interview.company} • {interview.position}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="capitalize">{interview.interviewType}</span>
                      <span>•</span>
                      <span>{format(new Date(interview.startedAt), 'MMM d, yyyy')}</span>
                      {interview.duration && (
                        <>
                          <span>•</span>
                          <span>{Math.round(interview.duration / 60)} minutes</span>
                        </>
                      )}
                    </div>
                    {interview.feedback && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-6">
                          <div>
                            <div className="text-2xl font-bold text-primary-600">
                              {interview.feedback.overallScore}%
                            </div>
                            <div className="text-xs text-gray-500">Overall Score</div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-gray-700 line-clamp-2">
                              {interview.feedback.detailedFeedback}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setSelectedInterview(interview)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye size={20} />
                    </button>
                    <button
                      onClick={() => handleDelete(interview.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
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

      {selectedInterview && (
        <InterviewDetailModal
          interview={selectedInterview}
          onClose={() => setSelectedInterview(null)}
        />
      )}
    </div>
  );
};

interface InterviewDetailModalProps {
  interview: Interview;
  onClose: () => void;
}

const InterviewDetailModal: React.FC<InterviewDetailModalProps> = ({
  interview,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-bold text-gray-900">{interview.title}</h2>
          <p className="text-gray-600 mt-1">
            {interview.company} • {interview.position}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Feedback */}
          {interview.feedback && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Feedback</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <div className="text-3xl font-bold text-primary-600 mb-1">
                    {interview.feedback.overallScore}%
                  </div>
                  <p className="text-sm text-gray-600">Overall Score</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Strengths</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    {interview.feedback.strengths.map((strength, idx) => (
                      <li key={idx}>{strength}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Areas for Improvement</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    {interview.feedback.weaknesses.map((weakness, idx) => (
                      <li key={idx}>{weakness}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Suggestions</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    {interview.feedback.suggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Detailed Feedback</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {interview.feedback.detailedFeedback}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Transcript */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Transcript</h3>
            <div className="space-y-3">
              {interview.transcript
                .filter((msg) => msg.role !== 'system')
                .map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary-50 ml-12'
                        : 'bg-gray-100 mr-12'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">
                        {message.role === 'user' ? 'You' : 'Interviewer'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(message.timestamp), 'h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewHistory;
