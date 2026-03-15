import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Loader2, Terminal, ExternalLink,
  ChevronLeft, FileText, Briefcase, Check,
  Sparkles, Building2, User, Tag, ArrowRight,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { InterviewType, UploadedDocument } from '../../types';
import { LemonSelect } from '../components/lemon/LemonSelect';

const INPUT_CLASS =
  'w-full px-8 py-5 bg-white dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/10 rounded-2xl text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none shadow-sm';
const LABEL_CLASS = 'block text-xs font-semibold text-gray-500 dark:text-white/30 uppercase tracking-widest mb-4';

type Step = 'initial' | 'setup';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { loadSettings } = useStore();
  const [step, setStep] = useState<Step>('initial');
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jobPostInputRef = useRef<HTMLInputElement>(null);

  const [isChecking, setIsChecking] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [lemonadeInstalled, setLemonadeInstalled] = useState<boolean | null>(null);
  const [serverRunning, setServerRunning] = useState(false);

  const [resumeDoc, setResumeDoc] = useState<UploadedDocument | null>(null);
  const [jobPostDoc, setJobPostDoc] = useState<UploadedDocument | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingJobPost, setIsUploadingJobPost] = useState(false);
  const resumeBase64Ref = useRef<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    company: '',
    position: '',
    interviewType: 'general' as InterviewType,
  });

  type ExtractionStep = 'idle' | 'analyzing' | 'extracting-company' | 'extracting-position' | 'extracting-title' | 'done' | 'error';
  const [extractionStep, setExtractionStep] = useState<ExtractionStep>('idle');
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const extractionTriggeredRef = useRef(false);

  const bothDocsUploaded = resumeDoc !== null && jobPostDoc !== null;
  const canBegin = bothDocsUploaded && !isChecking && lemonadeInstalled && serverRunning;
  const isFormValid = formData.title.trim() && formData.company.trim() && formData.position.trim();
  const isExtracting = extractionStep !== 'idle' && extractionStep !== 'done' && extractionStep !== 'error';

  useEffect(() => {
    performBackgroundChecks();
  }, []);

  const performBackgroundChecks = async () => {
    if (!window.electronAPI) {
      setLemonadeInstalled(true);
      setServerRunning(true);
      setIsChecking(false);
      return;
    }
    setIsChecking(true);
    setStartError(null);
    try {
      const installation = await window.electronAPI.checkLemonadeInstallation();
      setLemonadeInstalled(installation.installed);
      if (!installation.installed) {
        setStartError('Lemonade Server is not installed. Download it from lemonade-server.ai to get started.');
        setIsChecking(false);
        return;
      }
      const serverStatus = await window.electronAPI.getServerStatus();
      setServerRunning(serverStatus.isRunning);
      if (!serverStatus.isRunning) {
        setStartError('Lemonade Server is installed but not running. Start it with: lemonade-server serve');
        setIsChecking(false);
        return;
      }
      await loadSettings();
    } catch (error: any) {
      setStartError(`Connection failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsChecking(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (window.electronAPI) {
      setIsUploadingResume(true);
      try {
        const fileData = await fileToBase64(file);
        resumeBase64Ref.current = fileData;
        const doc = await window.electronAPI.uploadDocument({ type: 'resume', fileName: file.name, fileData });
        setResumeDoc(doc);
      } catch (error) {
        setStartError('Failed to upload resume. Please try again.');
      } finally {
        setIsUploadingResume(false);
      }
    } else {
      const fileData = await fileToBase64(file);
      resumeBase64Ref.current = fileData;
      setResumeDoc({ id: 'browser-resume', type: 'resume', fileName: file.name, filePath: '', mimeType: file.type, fileSize: file.size, extractedText: '', uploadedAt: new Date().toISOString() });
    }
    e.target.value = '';
  };

  const handleJobPostUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (window.electronAPI) {
      setIsUploadingJobPost(true);
      try {
        const fileData = await fileToBase64(file);
        const doc = await window.electronAPI.uploadDocument({ type: 'job_post', fileName: file.name, fileData });
        setJobPostDoc(doc);
      } catch (error) {
        setStartError('Failed to upload job post. Please try again.');
      } finally {
        setIsUploadingJobPost(false);
      }
    } else {
      setJobPostDoc({ id: 'browser-jobpost', type: 'job_post', fileName: file.name, filePath: '', mimeType: file.type, fileSize: file.size, extractedText: '', uploadedAt: new Date().toISOString() });
    }
    e.target.value = '';
  };

  const triggerExtraction = useCallback(async () => {
    if (!jobPostDoc?.id || !window.electronAPI || extractionTriggeredRef.current) return;
    extractionTriggeredRef.current = true;
    setExtractionStep('analyzing');
    setExtractionError(null);
    try {
      await new Promise(r => setTimeout(r, 600));
      setExtractionStep('extracting-company');
      const result = await window.electronAPI.extractJobDetails(jobPostDoc.id);
      if (result.company) setFormData(prev => ({ ...prev, company: result.company }));
      await new Promise(r => setTimeout(r, 400));
      setExtractionStep('extracting-position');
      if (result.position) setFormData(prev => ({ ...prev, position: result.position }));
      await new Promise(r => setTimeout(r, 400));
      setExtractionStep('extracting-title');
      if (result.title) setFormData(prev => ({ ...prev, title: result.title }));
      if (result.interviewType) {
        const validTypes: InterviewType[] = ['general', 'technical', 'behavioral', 'system-design', 'coding', 'mixed'];
        if (validTypes.includes(result.interviewType as InterviewType)) {
          setFormData(prev => ({ ...prev, interviewType: result.interviewType as InterviewType }));
        }
      }
      await new Promise(r => setTimeout(r, 300));
      setExtractionStep('done');
    } catch (err: any) {
      setExtractionStep('error');
      setExtractionError("AI couldn't auto-fill — enter details manually or retry.");
      extractionTriggeredRef.current = false;
    }
  }, [jobPostDoc]);

  useEffect(() => {
    if (step === 'setup' && jobPostDoc && !extractionTriggeredRef.current) {
      triggerExtraction();
    }
  }, [step, jobPostDoc, triggerExtraction]);

  const handleBeginClick = () => {
    if (!canBegin) return;
    setStartError(null);
    extractionTriggeredRef.current = false;
    setExtractionStep('idle');
    setStep('setup');
  };

  const handleSetupNext = () => {
    if (!isFormValid) return;
    navigate('/preparing', {
      state: {
        formData,
        resumeDocId: resumeDoc?.id || null,
        resumeFileName: resumeDoc?.fileName || null,
        resumeBase64: resumeBase64Ref.current,
        jobPostDocId: jobPostDoc?.id || null,
        jobPostFileName: jobPostDoc?.fileName || null,
      },
    });
  };

  return (
    <div className="h-screen w-full bg-lemonade-bg dark:bg-lemonade-dark-bg text-black dark:text-white overflow-hidden flex relative transition-colors duration-300">
      <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleResumeUpload} />
      <input ref={jobPostInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleJobPostUpload} />

      {/* ===== STEP: INITIAL ===== */}
      {step === 'initial' && (
        <div className="flex-1 flex flex-col items-center justify-center px-16">
          {/* Hero Section */}
          <div className="flex flex-col items-center mb-20">
            <img src="/logo.png" alt="lemonade" className="w-24 h-24 mb-8 drop-shadow-lg" />
            <h1 className="text-6xl font-bold tracking-tight mb-4">interviewer</h1>
            <p className="text-lg text-gray-500 dark:text-white/40 font-light">
              Your AI-powered interview preparation partner
            </p>
          </div>

          {/* Upload Section */}
          <div className="flex items-center gap-12 mb-16">
            <UploadButton
              onClick={() => resumeInputRef.current?.click()}
              isUploading={isUploadingResume}
              doc={resumeDoc}
              icon={<FileText size={28} />}
              label="Upload Resume"
              sublabel={resumeDoc ? resumeDoc.fileName : 'PDF, DOC, or TXT'}
            />
            <UploadButton
              onClick={() => jobPostInputRef.current?.click()}
              isUploading={isUploadingJobPost}
              doc={jobPostDoc}
              icon={<Briefcase size={28} />}
              label="Upload Job Post"
              sublabel={jobPostDoc ? jobPostDoc.fileName : 'PDF, DOC, or TXT'}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={handleBeginClick}
              disabled={!canBegin}
              className={`h-16 px-12 rounded-full font-semibold text-lg tracking-wide transition-all duration-500 flex items-center gap-4 shadow-lg active:scale-95 disabled:cursor-not-allowed ${
                canBegin
                  ? 'bg-lemonade-accent text-black hover:bg-lemonade-accent-hover hover:shadow-xl hover:scale-105'
                  : 'bg-white dark:bg-white/[0.06] text-gray-400 dark:text-white/30 border-2 border-gray-200 dark:border-white/10'
              }`}
            >
              {isChecking ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Begin'}
              {canBegin && <ArrowRight size={20} />}
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="h-16 px-12 rounded-full font-semibold text-lg tracking-wide transition-all duration-500 flex items-center gap-4 border-2 border-lemonade-accent bg-transparent text-black dark:text-lemonade-accent hover:bg-lemonade-bg dark:hover:bg-lemonade-accent/10 hover:shadow-md active:scale-95"
            >
              Dashboard
            </button>
          </div>

          {!bothDocsUploaded && !startError && !isChecking && (
            <p className="text-base text-gray-400 dark:text-white/30 font-light">
              Upload both documents to begin your interview journey
            </p>
          )}

          {startError && (
            <div className="mt-12 p-8 bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-3xl flex flex-col gap-4 text-red-700 dark:text-red-400 text-base max-w-xl shadow-lg">
              <div className="flex items-center gap-4">
                <AlertCircle size={20} className="shrink-0" />
                <p className="font-medium">{startError}</p>
              </div>
              {lemonadeInstalled === false && (
                <div className="ml-9 space-y-3">
                  <a
                    href="https://lemonade-server.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-3 px-6 py-3 bg-lemonade-accent hover:bg-lemonade-accent-hover text-black font-semibold rounded-2xl transition-colors"
                  >
                    <ExternalLink size={14} />
                    Download Lemonade Server
                  </a>
                  <p className="text-sm text-gray-500 dark:text-white/40">After installing, restart this application.</p>
                </div>
              )}
              {lemonadeInstalled === true && !serverRunning && (
                <div className="ml-9 p-4 bg-gray-900 text-green-400 rounded-2xl font-mono text-sm flex items-center gap-3">
                  <Terminal size={14} className="shrink-0 text-gray-500" />
                  <code>lemonade-server serve</code>
                </div>
              )}
              <button onClick={performBackgroundChecks} className="text-sm font-semibold hover:underline text-left ml-9">
                Retry Connection
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP: SETUP ===== */}
      {step === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center px-16 py-12">
          {/* Header */}
          <div className="flex flex-col items-center mb-16">
            <button
              onClick={() => setStep('initial')}
              className="flex items-center gap-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors mb-8"
            >
              <ChevronLeft size={20} />
              <span className="text-sm font-medium">Back</span>
            </button>
            <h1 className="text-4xl font-bold tracking-tight mb-3">Set up your interview</h1>
            <p className="text-base text-gray-500 dark:text-white/40 font-light">
              Tell us about the role you're preparing for
            </p>
          </div>

          <div className="w-full max-w-5xl">
            {/* AI Extraction Progress */}
            {isExtracting && (
              <div className="mb-12 p-8 bg-white dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.08] rounded-3xl shadow-sm">
                <div className="flex items-center gap-5 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-lemonade-accent/10 flex items-center justify-center">
                    <Sparkles size={28} className="text-lemonade-accent-hover" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold">AI is reading your job post</p>
                    <p className="text-base text-gray-500 dark:text-white/40 mt-1">Auto-filling details so you don't have to</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <ExtractionStepRow icon={<FileText size={16} />} label="Analyzing job posting" isActive={extractionStep === 'analyzing'} isDone={extractionStep !== 'analyzing'} />
                  <ExtractionStepRow icon={<Building2 size={16} />} label="Extracting company" isActive={extractionStep === 'extracting-company'} isDone={extractionStep === 'extracting-position' || extractionStep === 'extracting-title'} />
                  <ExtractionStepRow icon={<User size={16} />} label="Extracting position" isActive={extractionStep === 'extracting-position'} isDone={extractionStep === 'extracting-title'} />
                  <ExtractionStepRow icon={<Tag size={16} />} label="Generating title" isActive={extractionStep === 'extracting-title'} isDone={false} />
                </div>
              </div>
            )}

            {extractionStep === 'done' && (
              <div className="mb-10 p-6 flex items-center gap-5 bg-green-50 dark:bg-green-500/10 border border-green-200/60 dark:border-green-500/15 rounded-2xl">
                <Check size={18} className="text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-base font-medium text-green-700 dark:text-green-400">Details auto-filled. Review before continuing.</p>
              </div>
            )}

            {extractionStep === 'error' && extractionError && (
              <div className="mb-10 p-6 flex items-center justify-between gap-5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/15 rounded-2xl">
                <div className="flex items-center gap-4">
                  <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-base font-medium text-amber-700 dark:text-amber-400">{extractionError}</p>
                </div>
                <button
                  onClick={triggerExtraction}
                  className="shrink-0 text-base font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Form */}
            <div className="bg-white dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/[0.08] rounded-3xl p-10 shadow-sm">
              <div className="space-y-8">
                <div>
                  <label className={LABEL_CLASS}>
                    <span className="flex items-center gap-2">Job Title <FieldStatusIcon isLoading={isExtracting && !formData.title} isDone={extractionStep === 'done' && !!formData.title} /></span>
                  </label>
                  <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={INPUT_CLASS} placeholder={isExtracting ? 'AI is generating...' : 'e.g., Senior Software Engineer Interview'} autoFocus={!isExtracting} />
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <label className={LABEL_CLASS}>
                      <span className="flex items-center gap-2">Company <FieldStatusIcon isLoading={['analyzing', 'extracting-company'].includes(extractionStep) && !formData.company} isDone={!['idle', 'analyzing', 'extracting-company', 'error'].includes(extractionStep) && !!formData.company} /></span>
                    </label>
                    <input type="text" value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className={INPUT_CLASS} placeholder={isExtracting ? 'Extracting...' : 'e.g., Tech Corp'} />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>
                      <span className="flex items-center gap-2">Position <FieldStatusIcon isLoading={['analyzing', 'extracting-company', 'extracting-position'].includes(extractionStep) && !formData.position} isDone={!['idle', 'analyzing', 'extracting-company', 'extracting-position', 'error'].includes(extractionStep) && !!formData.position} /></span>
                    </label>
                    <input type="text" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className={INPUT_CLASS} placeholder={isExtracting ? 'Extracting...' : 'e.g., Senior Engineer'} />
                  </div>
                </div>

                <div>
                  <label className={LABEL_CLASS}>Interview Type</label>
                  <LemonSelect
                    value={formData.interviewType}
                    onChange={(value) => setFormData({ ...formData, interviewType: value as InterviewType })}
                    placeholder="Select interview type"
                    options={[
                      { value: 'general', label: 'General Interview' },
                      { value: 'technical', label: 'Technical Assessment' },
                      { value: 'behavioral', label: 'Behavioral Fit' },
                      { value: 'system-design', label: 'System Design' },
                      { value: 'coding', label: 'Live Coding' },
                      { value: 'mixed', label: 'Mixed Format' },
                    ]}
                  />
                </div>
              </div>

              {/* Attached Files */}
              <div className="mt-10 pt-8 border-t border-gray-100/60 dark:border-white/[0.04] flex gap-4 flex-wrap">
                {resumeDoc && (
                  <span className="flex items-center gap-3 px-5 py-3 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-xl text-sm text-gray-600 dark:text-white/60">
                    <FileText size={15} className="text-lemonade-accent-hover" />
                    <span className="font-medium">{resumeDoc.fileName}</span>
                  </span>
                )}
                {jobPostDoc && (
                  <span className="flex items-center gap-3 px-5 py-3 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] rounded-xl text-sm text-gray-600 dark:text-white/60">
                    <Briefcase size={15} className="text-lemonade-accent-hover" />
                    <span className="font-medium">{jobPostDoc.fileName}</span>
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-4 mt-10">
                <button
                  onClick={() => setStep('initial')}
                  className="flex items-center justify-center gap-3 px-8 py-5 border border-gray-200/60 dark:border-white/10 text-gray-600 dark:text-white/50 font-semibold text-base rounded-2xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <ChevronLeft size={20} />
                  Back
                </button>
                <button
                  onClick={handleSetupNext}
                  disabled={!isFormValid || isExtracting}
                  className="flex-1 px-8 py-5 bg-lemonade-accent text-black font-semibold text-base rounded-2xl hover:bg-lemonade-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isExtracting ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 size={18} className="animate-spin" />
                      AI is filling details...
                    </span>
                  ) : (
                    'Continue'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Sub-components ──────────────────────────────────────── */

const UploadButton: React.FC<{
  onClick: () => void;
  isUploading: boolean;
  doc: UploadedDocument | null;
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
}> = ({ onClick, isUploading, doc, icon, label, sublabel }) => (
  <button
    onClick={onClick}
    disabled={isUploading}
    className={`w-72 h-32 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
      doc
        ? 'border-green-400/50 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 shadow-lg scale-105'
        : 'border-gray-300 dark:border-white/10 bg-white dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:border-lemonade-accent hover:text-black dark:hover:text-white hover:shadow-lg hover:scale-105'
    }`}
  >
    {isUploading ? (
      <Loader2 className="w-7 h-7 animate-spin" />
    ) : doc ? (
      <>
        <div className="w-12 h-12 rounded-2xl bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
          <Check className="w-6 h-6" />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-base font-semibold">{doc.fileName}</span>
          <span className="text-xs text-green-600 dark:text-green-400 mt-1">Uploaded successfully</span>
        </div>
      </>
    ) : (
      <>
        <div className="w-14 h-14 rounded-2xl bg-lemonade-accent/10 flex items-center justify-center">
          {icon}
        </div>
        <div className="flex flex-col items-center">
          <span className="text-lg font-semibold">{label}</span>
          <span className="text-sm text-gray-400 dark:text-white/30 mt-0.5">{sublabel}</span>
        </div>
      </>
    )}
  </button>
);

const ExtractionStepRow: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; isDone: boolean }> = ({ icon, label, isActive, isDone }) => (
  <div className="flex items-center gap-5">
    <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
      isActive ? 'bg-lemonade-accent/15 scale-110' : isDone ? 'bg-green-100 dark:bg-green-500/15' : 'bg-gray-100 dark:bg-white/[0.04]'
    }`}>
      {isActive ? <Loader2 size={16} className="animate-spin text-lemonade-accent-hover" /> : isDone ? <Check size={16} className="text-green-500" /> : <span className="text-gray-300 dark:text-white/15">{icon}</span>}
    </div>
    <p className={`text-base font-medium transition-colors ${isActive ? 'text-black dark:text-white' : isDone ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-white/20'}`}>
      {label}
    </p>
  </div>
);

const FieldStatusIcon: React.FC<{ isLoading: boolean; isDone: boolean }> = ({ isLoading, isDone }) => {
  if (isLoading) return <Loader2 size={12} className="animate-spin text-lemonade-accent-hover" />;
  if (isDone) return <Check size={12} className="text-green-500" />;
  return null;
};

export default Landing;
