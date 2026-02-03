import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Job, JobStatus } from '../../types';
import { format } from 'date-fns';

const Jobs: React.FC = () => {
  const { jobs, loadJobs } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  useEffect(() => {
    loadJobs();
  }, []);

  const handleEdit = (job: Job) => {
    setEditingJob(job);
    setShowModal(true);
  };

  const handleDelete = async (jobId: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this job application?'
    );

    if (confirmed) {
      try {
        await window.electronAPI.deleteJob(jobId);
        loadJobs();
      } catch (error) {
        console.error('Failed to delete job:', error);
      }
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingJob(null);
  };

  const groupedJobs = jobs.reduce((acc, job) => {
    if (!acc[job.status]) {
      acc[job.status] = [];
    }
    acc[job.status].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Job Applications</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={20} />
            Add Job
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Applications" value={jobs.length} color="blue" />
          <StatCard
            label="Interviewing"
            value={jobs.filter((j) => j.status === 'interviewing').length}
            color="yellow"
          />
          <StatCard
            label="Offers"
            value={jobs.filter((j) => j.status === 'offer').length}
            color="green"
          />
          <StatCard
            label="Applied"
            value={jobs.filter((j) => j.status === 'applied').length}
            color="purple"
          />
        </div>

        {/* Jobs by Status */}
        <div className="space-y-6">
          {(['interested', 'applied', 'interviewing', 'offer'] as JobStatus[]).map(
            (status) => (
              <div key={status}>
                {groupedJobs[status] && groupedJobs[status].length > 0 && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-3 capitalize">
                      {status.replace('-', ' ')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupedJobs[status].map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onEdit={() => handleEdit(job)}
                          onDelete={() => handleDelete(job.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {jobs.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-600 mb-4">No job applications yet.</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Add Your First Job
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <JobModal
          job={editingJob}
          onClose={handleModalClose}
          onSave={() => {
            handleModalClose();
            loadJobs();
          }}
        />
      )}
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => {
  const colors = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    green: 'border-green-200 bg-green-50 text-green-700',
    purple: 'border-purple-200 bg-purple-50 text-purple-700',
  };

  return (
    <div className={`border rounded-lg p-4 ${colors[color as keyof typeof colors]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
};

interface JobCardProps {
  job: Job;
  onEdit: () => void;
  onDelete: () => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onEdit, onDelete }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{job.title}</h3>
          <p className="text-sm text-gray-600">{job.company}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {job.description && (
        <p className="text-sm text-gray-700 mb-3 line-clamp-2">{job.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{job.interviewIds.length} interviews</span>
        {job.appliedAt && (
          <span>Applied {format(new Date(job.appliedAt), 'MMM d, yyyy')}</span>
        )}
      </div>

      {job.notes && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-600">
          {job.notes}
        </div>
      )}
    </div>
  );
};

interface JobModalProps {
  job: Job | null;
  onClose: () => void;
  onSave: () => void;
}

const JobModal: React.FC<JobModalProps> = ({ job, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: job?.title || '',
    company: job?.company || '',
    description: job?.description || '',
    status: job?.status || ('interested' as JobStatus),
    appliedAt: job?.appliedAt || '',
    notes: job?.notes || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (job) {
        await window.electronAPI.updateJob(job.id, formData);
      } else {
        await window.electronAPI.createJob(formData);
      }
      onSave();
    } catch (error) {
      console.error('Failed to save job:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-2xl font-bold text-gray-900">
            {job ? 'Edit Job Application' : 'Add Job Application'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Company *
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as JobStatus })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="interested">Interested</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Applied Date
              </label>
              <input
                type="date"
                value={formData.appliedAt}
                onChange={(e) => setFormData({ ...formData, appliedAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {job ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Jobs;
