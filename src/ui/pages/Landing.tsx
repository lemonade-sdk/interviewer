import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Loader2, Terminal, ExternalLink,
  ChevronLeft, FileText, Briefcase, Check,
  Sparkles, Building2, User, Tag,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { InterviewType, UploadedDocument } from '../../types';
import { LemonSelect } from '../components/lemon/LemonSelect';

const INPUT_CLASS =
  'w-full px-4 py-3 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/60 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 transition-all outline-none';
const LABEL_CLASS = 'block text-xs font-medium text-gray-400 dark:text-white/30 uppercase tracking-wider mb-2.5';

type Step = 'initial' | 'setup' | 'selection';

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
    setStep('selection');
  };

  const handleSelectionClick = (type: 'single' | 'multi') => {
    navigate('/preparing', {
      state: {
        formData,
        interviewMode: type,
        resumeDocId: resumeDoc?.id || null,
        resumeFileName: resumeDoc?.fileName || null,
        resumeBase64: resumeBase64Ref.current,
        jobPostDocId: jobPostDoc?.id || null,
        jobPostFileName: jobPostDoc?.fileName || null,
      },
    });
  };

  return (
    <div className="h-screen w-full bg-lemonade-bg dark:bg-lemonade-dark-bg text-black dark:text-white overflow-hidden flex flex-col items-center justify-center relative transition-colors duration-300">
      <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleResumeUpload} />
      <input ref={jobPostInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleJobPostUpload} />

      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-10">
        <img src="/logo.png" alt="lemonade" className="w-16 h-16 mb-4" />
        <h1 className="text-2xl font-bold tracking-tight">interviewer</h1>
        <p className={`mt-2 text-sm text-gray-500 dark:text-white/40 transition-all duration-500 ${
          step !== 'initial' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          {step === 'setup' ? 'Set up your interview' : step === 'selection' ? 'Choose your interview format' : ''}
        </p>
      </div>

      {/* ===== STEP: INITIAL ===== */}
      {step === 'initial' && (
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-5 mb-8">
            <UploadButton
              onClick={() => resumeInputRef.current?.click()}
              isUploading={isUploadingResume}
              doc={resumeDoc}
              icon={<FileText size={18} />}
              label="Upload Resume"
            />
            <UploadButton
              onClick={() => jobPostInputRef.current?.click()}
              isUploading={isUploadingJobPost}
              doc={jobPostDoc}
              icon={<Briefcase size={18} />}
              label="Upload Job Post"
            />
          </div>

          <div className="flex items-center gap-5">
            <button
              onClick={handleBeginClick}
              disabled={!canBegin}
              className={`w-48 h-12 rounded-full font-semibold text-sm tracking-wide transition-all duration-500 flex items-center justify-center shadow-md active:scale-95 disabled:cursor-not-allowed ${
                canBegin
                  ? 'bg-lemonade-accent text-black hover:bg-lemonade-accent-hover hover:shadow-lg'
                  : 'bg-white dark:bg-white/[0.06] text-gray-400 dark:text-white/30 border-2 border-gray-200 dark:border-white/10'
              }`}
            >
              {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'begin'}
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-48 h-12 rounded-full font-semibold text-sm tracking-wide transition-all duration-500 flex items-center justify-center border-2 border-lemonade-accent bg-white dark:bg-transparent text-black dark:text-lemonade-accent hover:bg-lemonade-bg dark:hover:bg-lemonade-accent/10 hover:shadow-md active:scale-95"
            >
              dashboard
            </button>
          </div>

          {!bothDocsUploaded && !startError && !isChecking && (
            <p className="mt-4 text-xs text-gray-400 dark:text-white/30">
              Upload both your resume and the job post to begin.
            </p>
          )}

          {startError && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-2xl flex flex-col gap-3 text-red-700 dark:text-red-400 text-sm max-w-lg">
              <div className="flex items-center gap-3">
                <AlertCircle size={16} className="shrink-0" />
                <p>{startError}</p>
              </div>
              {lemonadeInstalled === false && (
                <div className="ml-7 space-y-2">
                  <a
                    href="https://lemonade-server.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-lemonade-accent hover:bg-lemonade-accent-hover text-black font-semibold rounded-xl transition-colors text-xs"
                  >
                    <ExternalLink size={12} />
                    Download Lemonade Server
                  </a>
                  <p className="text-xs text-gray-500 dark:text-white/40">After installing, restart this application.</p>
                </div>
              )}
              {lemonadeInstalled === true && !serverRunning && (
                <div className="ml-7 p-3 bg-gray-900 text-green-400 rounded-xl font-mono text-xs flex items-center gap-2">
                  <Terminal size={12} className="shrink-0 text-gray-500" />
                  <code>lemonade-server serve</code>
                </div>
              )}
              <button onClick={performBackgroundChecks} className="text-xs font-semibold hover:underline text-left ml-7">
                Retry Connection
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP: SETUP ===== */}
      {step === 'setup' && (
        <div className="w-full max-w-lg px-6">
          <div className="bg-lemonade-bg dark:bg-white/[0.04] rounded-2xl border border-gray-200/50 dark:border-white/5 p-8">

            {/* AI extraction progress */}
            {isExtracting && (
              <div className="mb-8 pb-7 border-b border-gray-100/60 dark:border-white/[0.04]">
                <div className="flex items-center gap-3.5 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-lemonade-accent/10 flex items-center justify-center">
                    <Sparkles size={18} className="text-lemonade-accent-hover" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">AI is reading your job post</p>
                    <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5">Auto-filling details so you don't have to</p>
                  </div>
                </div>
                <div className="space-y-3.5">
                  <ExtractionStepRow icon={<FileText size={12} />} label="Analyzing job posting" isActive={extractionStep === 'analyzing'} isDone={extractionStep !== 'analyzing'} />
                  <ExtractionStepRow icon={<Building2 size={12} />} label="Extracting company" isActive={extractionStep === 'extracting-company'} isDone={extractionStep === 'extracting-position' || extractionStep === 'extracting-title'} />
                  <ExtractionStepRow icon={<User size={12} />} label="Extracting position" isActive={extractionStep === 'extracting-position'} isDone={extractionStep === 'extracting-title'} />
                  <ExtractionStepRow icon={<Tag size={12} />} label="Generating title" isActive={extractionStep === 'extracting-title'} isDone={false} />
                </div>
              </div>
            )}

            {extractionStep === 'done' && (
              <div className="mb-7 flex items-center gap-3 px-4 py-3.5 bg-green-50 dark:bg-green-500/10 border border-green-200/60 dark:border-green-500/15 rounded-xl">
                <Check size={14} className="text-green-600 dark:text-green-400 shrink-0" />
                <p className="text-xs font-medium text-green-700 dark:text-green-400">Details auto-filled. Review before continuing.</p>
              </div>
            )}

            {extractionStep === 'error' && extractionError && (
              <div className="mb-7 flex items-center justify-between gap-3 px-4 py-3.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/15 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{extractionError}</p>
                </div>
                <button
                  onClick={triggerExtraction}
                  className="shrink-0 text-[11px] font-semibold text-amber-700 dark:text-amber-400 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className={LABEL_CLASS}>
                  <span className="flex items-center gap-2">Title <FieldStatusIcon isLoading={isExtracting && !formData.title} isDone={extractionStep === 'done' && !!formData.title} /></span>
                </label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={INPUT_CLASS} placeholder={isExtracting ? 'AI is generating...' : 'e.g., Senior Software Engineer Interview'} autoFocus={!isExtracting} />
              </div>
              <div className="grid grid-cols-2 gap-5">
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
                  placeholder="Select type"
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

            {/* Attached files */}
            <div className="mt-7 pt-6 border-t border-gray-100/60 dark:border-white/[0.04] flex gap-3 flex-wrap text-xs text-gray-500 dark:text-white/40">
              {resumeDoc && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/5 rounded-xl">
                  <FileText size={11} className="text-lemonade-accent-hover" />
                  <span className="truncate max-w-[120px]">{resumeDoc.fileName}</span>
                </span>
              )}
              {jobPostDoc && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/5 rounded-xl">
                  <Briefcase size={11} className="text-lemonade-accent-hover" />
                  <span className="truncate max-w-[120px]">{jobPostDoc.fileName}</span>
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3.5 mt-7">
              <button
                onClick={() => setStep('initial')}
                className="flex items-center justify-center gap-2 px-5 py-3 border border-gray-200/60 dark:border-white/10 text-gray-600 dark:text-white/50 font-semibold text-sm rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <ChevronLeft size={16} />
                Back
              </button>
              <button
                onClick={handleSetupNext}
                disabled={!isFormValid || isExtracting}
                className="flex-1 px-5 py-3 bg-lemonade-accent text-black font-semibold text-sm rounded-xl hover:bg-lemonade-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isExtracting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    AI is filling details...
                  </span>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP: SELECTION ===== */}
      {step === 'selection' && (
        <div className="flex flex-col items-center">
          <div className="mb-8 text-center">
            <p className="text-base font-semibold">{formData.title}</p>
            <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
              {formData.company} &middot; {formData.position} &middot; {formData.interviewType}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => handleSelectionClick('single')}
              className="w-48 py-3.5 rounded-xl font-semibold text-sm border border-gray-200 dark:border-white/10 bg-lemonade-bg dark:bg-white/[0.04] text-black dark:text-white hover:border-lemonade-accent transition-colors active:scale-[0.98]"
            >
              One Stage Interview
            </button>
            <button
              onClick={() => handleSelectionClick('multi')}
              className="w-48 py-3.5 rounded-xl font-semibold text-sm border border-gray-200 dark:border-white/10 bg-lemonade-bg dark:bg-white/[0.04] text-black dark:text-white hover:border-lemonade-accent transition-colors active:scale-[0.98]"
            >
              Multi Stage Interview
            </button>
          </div>

          <button
            onClick={() => setStep('setup')}
            className="mt-5 flex items-center gap-1 text-sm text-gray-500 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={14} />
            Back to details
          </button>
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
}> = ({ onClick, isUploading, doc, icon, label }) => (
  <button
    onClick={onClick}
    disabled={isUploading}
    className={`w-48 h-20 rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-1.5 ${
      doc
        ? 'border-green-400/50 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
        : 'border-gray-200 dark:border-white/10 bg-lemonade-bg dark:bg-white/[0.03] text-gray-500 dark:text-white/40 hover:border-lemonade-accent hover:text-black dark:hover:text-white'
    }`}
  >
    {isUploading ? (
      <Loader2 className="w-4 h-4 animate-spin" />
    ) : doc ? (
      <>
        <Check className="w-4 h-4" />
        <span className="text-xs font-medium truncate max-w-[160px] px-2">{doc.fileName}</span>
      </>
    ) : (
      <>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </>
    )}
  </button>
);

const ExtractionStepRow: React.FC<{ icon: React.ReactNode; label: string; isActive: boolean; isDone: boolean }> = ({ icon, label, isActive, isDone }) => (
  <div className="flex items-center gap-3">
    <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
      isActive ? 'bg-lemonade-accent/15' : isDone ? 'bg-green-100 dark:bg-green-500/15' : 'bg-gray-100 dark:bg-white/[0.04]'
    }`}>
      {isActive ? <Loader2 size={12} className="animate-spin text-lemonade-accent-hover" /> : isDone ? <Check size={12} className="text-green-500" /> : <span className="text-gray-300 dark:text-white/15">{icon}</span>}
    </div>
    <p className={`text-[13px] font-medium transition-colors ${isActive ? 'text-black dark:text-white' : isDone ? 'text-green-600 dark:text-green-400' : 'text-gray-300 dark:text-white/20'}`}>
      {label}
    </p>
  </div>
);

const FieldStatusIcon: React.FC<{ isLoading: boolean; isDone: boolean }> = ({ isLoading, isDone }) => {
  if (isLoading) return <Loader2 size={10} className="animate-spin text-lemonade-accent-hover" />;
  if (isDone) return <Check size={10} className="text-green-500" />;
  return null;
};

export default Landing;
