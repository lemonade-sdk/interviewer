import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Briefcase, Calendar, MessageSquare } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Job, JobStatus } from '../../types';
import { format } from 'date-fns';
import { LemonCard } from '../components/lemon';

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
    <div className="h-full overflow-y-auto bg-lemonade-bg dark:bg-lemonade-dark-bg transition-colors duration-300">
      <div className="p-8 max-w-5xl mx-auto space-y-8 pb-16">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#cfcfcf]">
              Job Applications
            </h1>
            <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
              Track your applications and interview progress
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-6 py-3 bg-lemonade-accent text-black font-semibold rounded-xl hover:bg-lemonade-accent-hover transition-colors duration-200 active:scale-[0.98]"
          >
            <Plus size={16} />
            Add Job
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          <StatCard
            icon={<Briefcase size={20} />}
            label="Total Applications"
            value={jobs.length}
            color="blue"
          />
          <StatCard
            icon={<MessageSquare size={20} />}
            label="Interviewing"
            value={jobs.filter((j) => j.status === 'interviewing').length}
            color="yellow"
          />
          <StatCard
            icon={<Calendar size={20} />}
            label="Offers"
            value={jobs.filter((j) => j.status === 'offer').length}
            color="green"
          />
          <StatCard
            icon={<Briefcase size={20} />}
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
                  <div className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
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
            <LemonCard noPadding>
              <div className="text-center py-16">
                <Briefcase size={32} className="mx-auto text-gray-300 dark:text-white/15 mb-4" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white/80">No job applications yet</h3>
                <p className="text-sm text-gray-500 dark:text-white/40 mt-1 mb-6 max-w-xs mx-auto">
                  Track your job applications and link them to practice interviews.
                </p>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-6 py-3 bg-lemonade-accent text-black font-semibold rounded-xl hover:bg-lemonade-accent-hover transition-colors"
                >
                  Add Your First Job
                </button>
              </div>
            </LemonCard>
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
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-500',
    yellow: 'bg-yellow-500/10 text-yellow-500',
    green: 'bg-green-500/10 text-green-500',
    purple: 'bg-purple-500/10 text-purple-500',
  };

  return (
    <LemonCard>
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color as keyof typeof colorMap]}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-white/30">
            {label}
          </p>
          <p className="text-2xl font-bold mt-0.5">{value}</p>
        </div>
      </div>
    </LemonCard>
  );
};

interface JobCardProps {
  job: Job;
  onEdit: () => void;
  onDelete: () => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, onEdit, onDelete }) => {
  return (
    <LemonCard className="hover:border-gray-300/60 dark:hover:border-white/10 transition-all duration-200">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white/90 truncate">{job.title}</h3>
          <p className="text-sm text-gray-600 dark:text-white/60 truncate">{job.company}</p>
        </div>
        <div className="flex gap-1 ml-3">
          <button
            onClick={onEdit}
            className="p-2 rounded-xl text-gray-400 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
            title="Edit"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-xl text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {job.description && (
        <p className="text-sm text-gray-700 dark:text-white/70 mb-3 line-clamp-2 leading-relaxed">{job.description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-white/40">
        <span className="flex items-center gap-1">
          <MessageSquare size={12} />
          {job.interviewIds.length} interviews
        </span>
        {job.appliedAt && (
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {format(new Date(job.appliedAt), 'MMM d, yyyy')}
          </span>
        )}
      </div>

      {job.notes && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl text-xs text-gray-600 dark:text-white/60">
          {job.notes}
        </div>
      )}
    </LemonCard>
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

  const INPUT_CLASS = 'w-full px-3 py-2 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none';
  const LABEL_CLASS = 'block text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-lemonade-bg dark:bg-lemonade-dark-surface border border-gray-200/50 dark:border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transition-colors duration-300">
        <div className="border-b border-gray-200/50 dark:border-white/[0.08] px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#cfcfcf]">
            {job ? 'Edit Job Application' : 'Add Job Application'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
            Track your job application and link practice interviews
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={LABEL_CLASS}>
                Job Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={INPUT_CLASS}
                placeholder="e.g., Senior Software Engineer"
                required
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>
                Company *
              </label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className={INPUT_CLASS}
                placeholder="e.g., Tech Corp"
                required
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className={INPUT_CLASS}
              placeholder="Brief description of the role..."
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className={LABEL_CLASS}>
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as JobStatus })
                }
                className={INPUT_CLASS}
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
              <label className={LABEL_CLASS}>
                Applied Date
              </label>
              <input
                type="date"
                value={formData.appliedAt}
                onChange={(e) => setFormData({ ...formData, appliedAt: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className={INPUT_CLASS}
              placeholder="Additional notes or reminders..."
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-200/60 dark:border-white/10 text-gray-700 dark:text-white/70 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-lemonade-accent text-black font-semibold rounded-xl hover:bg-lemonade-accent-hover transition-colors active:scale-[0.98]"
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
