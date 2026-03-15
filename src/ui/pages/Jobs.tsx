import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Briefcase } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Job, JobStatus } from '../../types';
import { format } from 'date-fns';
import { LemonDialog } from '../components/lemon/LemonDialog';
import { LemonSelect } from '../components/lemon/LemonSelect';

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
    const confirmed = window.confirm('Are you sure you want to delete this job application?');
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
      <div className="p-12 max-w-6xl mx-auto space-y-8 pb-20">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-[#cfcfcf]">Job Applications</h1>
          <p className="text-base text-gray-500 dark:text-white/40 mt-3">Track your job search progress</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <StatCard label="Total Applications" value={jobs.length} variant="default" />
          <StatCard label="Interviewing" value={jobs.filter((j) => j.status === 'interviewing').length} variant="warning" />
          <StatCard label="Offers" value={jobs.filter((j) => j.status === 'offer').length} variant="success" />
          <StatCard label="Applied" value={jobs.filter((j) => j.status === 'applied').length} variant="info" />
        </div>

        {/* Add Job Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-3 px-6 py-3.5 bg-lemonade-accent text-black font-semibold text-base rounded-xl hover:bg-lemonade-accent-hover transition-colors shadow-sm"
          >
            <Plus size={20} />
            Add Job
          </button>
        </div>

        {/* Jobs by Status */}
        <div className="space-y-8">
          {(['interested', 'applied', 'interviewing', 'offer'] as JobStatus[]).map((status) => (
            <div key={status}>
              {groupedJobs[status] && groupedJobs[status].length > 0 && (
                <div>
                  <h2 className="text-base font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 mb-4 px-1">
                    {status.replace('-', ' ')}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {groupedJobs[status].map((job) => (
                      <JobCard key={job.id} job={job} onEdit={() => handleEdit(job)} onDelete={() => handleDelete(job.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {jobs.length === 0 && (
            <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-2xl p-16 text-center transition-colors">
              <Briefcase size={48} className="mx-auto text-gray-300 dark:text-white/15 mb-6" />
              <p className="text-base text-gray-500 dark:text-white/40 mb-6">No job applications yet.</p>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3.5 bg-lemonade-accent text-black font-semibold text-base rounded-xl hover:bg-lemonade-accent-hover transition-colors"
              >
                Add Your First Job
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <JobModal job={editingJob} onClose={handleModalClose} onSave={() => { handleModalClose(); loadJobs(); }} />
      )}
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  variant: 'default' | 'success' | 'warning' | 'info';
}

const StatCard: React.FC<StatCardProps> = ({ label, value, variant }) => {
  const variants = {
    default: 'bg-lemonade-bg dark:bg-white/[0.04] border-gray-200/50 dark:border-white/[0.08] text-gray-900 dark:text-white',
    success: 'bg-green-50 dark:bg-green-500/10 border-green-200/60 dark:border-green-500/15 text-green-800 dark:text-green-400',
    warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/15 text-amber-800 dark:text-amber-400',
    info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200/60 dark:border-blue-500/15 text-blue-800 dark:text-blue-400',
  };

  return (
    <div className={`border rounded-xl p-6 transition-colors ${variants[variant]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-2 opacity-80">{label}</div>
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
    <div className="bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-xl p-6 hover:border-lemonade-accent/40 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-base text-gray-900 dark:text-white/90">{job.title}</h3>
          <p className="text-base text-gray-500 dark:text-white/40 mt-1">{job.company}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="p-2.5 rounded-xl text-gray-400 dark:text-white/30 hover:text-black dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors" title="Edit">
            <Edit size={20} />
          </button>
          <button onClick={onDelete} className="p-2.5 rounded-xl text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {job.description && (
        <p className="text-base text-gray-600 dark:text-white/60 mb-4 line-clamp-2">{job.description}</p>
      )}

      <div className="flex items-center justify-between text-sm text-gray-400 dark:text-white/30">
        <span>{job.interviewIds.length} interviews</span>
        {job.appliedAt && (
          <span>Applied {format(new Date(job.appliedAt), 'MMMM d, yyyy')}</span>
        )}
      </div>

      {job.notes && (
        <div className="mt-4 p-4 bg-lemonade-bg dark:bg-white/[0.03] rounded-xl text-sm text-gray-600 dark:text-white/60">
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
    <LemonDialog
      open={showModal}
      onClose={handleModalClose}
      title={job ? 'Edit Job Application' : 'Add Job Application'}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">Job Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-5 py-3.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-xl text-base text-gray-900 dark:text-white focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none"
              required
            />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">Company *</label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-5 py-3.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-xl text-base text-gray-900 dark:text-white focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none"
              required
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={4}
            className="w-full px-5 py-3.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-xl text-base text-gray-900 dark:text-white focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">Status *</label>
            <LemonSelect
              value={formData.status}
              onChange={(value) => setFormData({ ...formData, status: value as JobStatus })}
              options={[
                { value: 'interested', label: 'Interested' },
                { value: 'applied', label: 'Applied' },
                { value: 'interviewing', label: 'Interviewing' },
                { value: 'offer', label: 'Offer' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'accepted', label: 'Accepted' },
                { value: 'declined', label: 'Declined' },
              ]}
            />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">Applied Date</label>
            <input
              type="date"
              value={formData.appliedAt}
              onChange={(e) => setFormData({ ...formData, appliedAt: e.target.value })}
              className="w-full px-5 py-3.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-xl text-base text-gray-900 dark:text-white focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-400 uppercase tracking-wider">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={4}
            className="w-full px-5 py-3.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-xl text-base text-gray-900 dark:text-white focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none resize-none"
          />
        </div>

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={onClose} className="flex-1 px-5 py-3.5 border border-gray-200/50 dark:border-white/[0.08] text-gray-700 dark:text-white/70 font-medium rounded-xl hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors">
            Cancel
          </button>
          <button type="submit" className="flex-1 px-5 py-3.5 bg-lemonade-accent text-black font-semibold rounded-xl hover:bg-lemonade-accent-hover transition-colors">
            {job ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </LemonDialog>
  );
};

export default Jobs;
