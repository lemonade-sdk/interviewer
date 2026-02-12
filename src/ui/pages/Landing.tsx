import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, Loader2, Terminal, ExternalLink,
  ChevronLeft, FileText, Briefcase, Check,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { InterviewType, UploadedDocument } from '../../types';

const BUTTON_CLASS =
  'w-52 h-14 rounded-full font-semibold text-base tracking-wide transition-all duration-500 flex items-center justify-center';

const INPUT_CLASS =
  'w-full px-5 py-4 bg-gray-50/50 border border-gray-200/60 rounded-2xl text-base text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-lemonade-accent focus:ring-4 focus:ring-lemonade-accent/10 transition-all duration-300 outline-none';
const LABEL_CLASS = 'block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 ml-1';

type Step = 'initial' | 'setup' | 'selection';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { loadSettings } = useStore();
  const [step, setStep] = useState<Step>('initial');
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jobPostInputRef = useRef<HTMLInputElement>(null);

  // ── System Check State (server install + running only) ──
  const [isChecking, setIsChecking] = useState(true);
  const [startError, setStartError] = useState<string | null>(null);
  const [lemonadeInstalled, setLemonadeInstalled] = useState<boolean | null>(null);
  const [serverRunning, setServerRunning] = useState(false);

  // ── Document Upload State ──
  const [resumeDoc, setResumeDoc] = useState<UploadedDocument | null>(null);
  const [jobPostDoc, setJobPostDoc] = useState<UploadedDocument | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingJobPost, setIsUploadingJobPost] = useState(false);
  // Keep base64 in memory so the Preparing page can render the PDF without re-reading
  const resumeBase64Ref = useRef<string | null>(null);

  // ── Interview Setup Form ──
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    position: '',
    interviewType: 'general' as InterviewType,
  });

  const bothDocsUploaded = resumeDoc !== null && jobPostDoc !== null;
  const canBegin = bothDocsUploaded && !isChecking && lemonadeInstalled && serverRunning;
  const isFormValid = formData.title.trim() && formData.company.trim() && formData.position.trim();

  // ── Background checks: only server install + running ──
  useEffect(() => {
    performBackgroundChecks();
  }, []);

  const performBackgroundChecks = async () => {
    if (!window.electronAPI) {
      console.info('Running in browser mode — Electron API not available');
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
        setStartError(
          'Lemonade Server is not installed on this system. Download it from lemonade-server.ai to get started.'
        );
        setIsChecking(false);
        return;
      }

      const serverStatus = await window.electronAPI.getServerStatus();
      setServerRunning(serverStatus.isRunning);

      if (!serverStatus.isRunning) {
        setStartError(
          'Lemonade Server is installed but not running. Start it with: lemonade-server serve'
        );
        setIsChecking(false);
        return;
      }

      await loadSettings();
    } catch (error: any) {
      console.error('Background check failed:', error);
      setStartError(`Connection failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsChecking(false);
    }
  };

  // ── File helpers ──
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
        const doc = await window.electronAPI.uploadDocument({
          type: 'resume',
          fileName: file.name,
          fileData,
        });
        setResumeDoc(doc);
        console.log('Resume uploaded:', doc.fileName, `(${doc.extractedText.length} chars)`);
      } catch (error) {
        console.error('Failed to upload resume:', error);
        setStartError('Failed to upload resume. Please try again.');
      } finally {
        setIsUploadingResume(false);
      }
    } else {
      const fileData = await fileToBase64(file);
      resumeBase64Ref.current = fileData;
      setResumeDoc({
        id: 'browser-resume',
        type: 'resume',
        fileName: file.name,
        filePath: '',
        mimeType: file.type,
        fileSize: file.size,
        extractedText: '',
        uploadedAt: new Date().toISOString(),
      });
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
        const doc = await window.electronAPI.uploadDocument({
          type: 'job_post',
          fileName: file.name,
          fileData,
        });
        setJobPostDoc(doc);
        console.log('Job post uploaded:', doc.fileName, `(${doc.extractedText.length} chars)`);
      } catch (error) {
        console.error('Failed to upload job post:', error);
        setStartError('Failed to upload job post. Please try again.');
      } finally {
        setIsUploadingJobPost(false);
      }
    } else {
      setJobPostDoc({
        id: 'browser-jobpost',
        type: 'job_post',
        fileName: file.name,
        filePath: '',
        mimeType: file.type,
        fileSize: file.size,
        extractedText: '',
        uploadedAt: new Date().toISOString(),
      });
    }
    e.target.value = '';
  };

  // ── Step navigation ──
  const handleBeginClick = () => {
    if (!canBegin) return;
    setStartError(null);
    setStep('setup');
  };

  const handleSetupNext = () => {
    if (!isFormValid) return;
    setStep('selection');
  };

  // ── Selection → navigate to /preparing (a separate page) ──
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

  // ── Demo / Dev Helpers ──
  const handleDemoMode = () => {
    setResumeDoc({
      id: 'demo-resume',
      type: 'resume',
      fileName: 'Demo_Resume.pdf',
      filePath: '',
      mimeType: 'application/pdf',
      fileSize: 1024,
      extractedText: 'Senior Software Engineer with 5 years of experience in React, Node.js, and TypeScript.',
      uploadedAt: new Date().toISOString(),
    });
    setJobPostDoc({
      id: 'demo-jobpost',
      type: 'job_post',
      fileName: 'Demo_Job_Description.pdf',
      filePath: '',
      mimeType: 'application/pdf',
      fileSize: 1024,
      extractedText: 'We are looking for a Senior Software Engineer to join our team. Must have experience with React and Node.js.',
      uploadedAt: new Date().toISOString(),
    });
    setFormData({
      title: 'Senior Software Engineer Interview',
      company: 'Demo Corp',
      position: 'Senior Software Engineer',
      interviewType: 'technical',
    });
    // Skip directly to setup if server is ready, else wait for checks
    if (lemonadeInstalled && serverRunning) {
      setStep('setup');
    }
  };

  return (
    <div className="h-screen w-full bg-lemonade-bg text-lemonade-fg overflow-hidden flex flex-col items-center justify-center relative">
      {/* Hidden file inputs */}
      <input
        ref={resumeInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleResumeUpload}
      />
      <input
        ref={jobPostInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        className="hidden"
        onChange={handleJobPostUpload}
      />

      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-12">
        <img
          src="/logo.png"
          alt="lemonade"
          className="w-20 h-20 mb-4 drop-shadow-lg"
        />
        <h1 className="text-3xl font-bold tracking-widest text-black">interviewer</h1>
        <p
          className={`mt-3 text-sm tracking-wide text-gray-500 transition-all duration-700 ${
            step !== 'initial'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          {step === 'setup'
            ? 'set up your interview'
            : step === 'selection'
              ? 'select your interview process'
              : ''}
        </p>
      </div>

      {/* ===== STEP: INITIAL ===== */}
      {step === 'initial' && (
        <div className="flex flex-col items-center">
          {/* Upload Areas */}
          <div className="flex items-center gap-6 mb-8">
            <button
              onClick={() => resumeInputRef.current?.click()}
              disabled={isUploadingResume}
              className={`w-52 h-20 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-1.5 ${
                resumeDoc
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white/60 text-gray-500 hover:border-lemonade-accent hover:text-black hover:bg-white'
              }`}
            >
              {isUploadingResume ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : resumeDoc ? (
                <>
                  <Check className="w-5 h-5" />
                  <span className="text-xs font-medium truncate max-w-[180px] px-2">{resumeDoc.fileName}</span>
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  <span className="text-xs font-semibold">upload resume</span>
                </>
              )}
            </button>

            <button
              onClick={() => jobPostInputRef.current?.click()}
              disabled={isUploadingJobPost}
              className={`w-52 h-20 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center gap-1.5 ${
                jobPostDoc
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white/60 text-gray-500 hover:border-lemonade-accent hover:text-black hover:bg-white'
              }`}
            >
              {isUploadingJobPost ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : jobPostDoc ? (
                <>
                  <Check className="w-5 h-5" />
                  <span className="text-xs font-medium truncate max-w-[180px] px-2">{jobPostDoc.fileName}</span>
                </>
              ) : (
                <>
                  <Briefcase className="w-5 h-5" />
                  <span className="text-xs font-semibold">upload job post</span>
                </>
              )}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-6">
            <button
              onClick={handleBeginClick}
              disabled={!canBegin}
              className={`${BUTTON_CLASS} shadow-md active:scale-95 disabled:cursor-not-allowed transition-all duration-500 ${
                canBegin
                  ? 'bg-lemonade-accent text-black hover:bg-lemonade-accent-hover hover:shadow-lg animate-pulse'
                  : 'bg-white text-gray-400 border-2 border-gray-200'
              }`}
            >
              {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'begin'}
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className={`${BUTTON_CLASS} border-2 border-lemonade-accent bg-white text-black hover:bg-lemonade-bg hover:shadow-md active:scale-95`}
            >
              dashboard
            </button>
          </div>

          {/* Demo Mode Button (for testing/dev) */}
          <button
            onClick={handleDemoMode}
            className="mt-4 text-xs font-semibold text-gray-400 hover:text-lemonade-accent-hover transition-colors"
          >
            try demo mode (skip upload)
          </button>

          {/* Upload hint */}
          {!bothDocsUploaded && !startError && !isChecking && (
            <p className="mt-4 text-xs text-gray-400 tracking-wide">
              upload both your resume and the job post to begin
            </p>
          )}

          {/* Error — only server install/running issues */}
          {startError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3 text-red-700 text-sm max-w-lg">
              <div className="flex items-center gap-3">
                <AlertCircle size={18} className="flex-shrink-0" />
                <p>{startError}</p>
              </div>

              {lemonadeInstalled === false && (
                <div className="ml-7 mt-1 flex flex-col gap-2">
                  <a
                    href="https://lemonade-server.ai/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors text-sm"
                  >
                    <ExternalLink size={14} />
                    Download Lemonade Server
                  </a>
                  <p className="text-xs text-gray-500">After installing, restart this application.</p>
                </div>
              )}

              {lemonadeInstalled === true && !serverRunning && (
                <div className="ml-7 mt-1 p-3 bg-gray-900 text-green-400 rounded-lg font-mono text-xs flex items-center gap-2">
                  <Terminal size={14} className="flex-shrink-0 text-gray-500" />
                  <code>lemonade-server serve</code>
                </div>
              )}

              <button
                onClick={performBackgroundChecks}
                className="text-xs font-bold uppercase tracking-wider hover:underline text-left ml-7"
              >
                Retry Connection
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP: SETUP ===== */}
      {step === 'setup' && (
        <div className="w-full max-w-lg px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/20 p-10 shadow-2xl shadow-black/5 ring-1 ring-black/5">
            <div className="space-y-7">
              <div>
                <label className={LABEL_CLASS}>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="e.g., Senior Software Engineer Interview"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className={LABEL_CLASS}>Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="e.g., Tech Corp"
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Position</label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="e.g., Senior Engineer"
                  />
                </div>
              </div>
              <div>
                <label className={LABEL_CLASS}>Interview Type</label>
                <div className="relative">
                  <select
                    value={formData.interviewType}
                    onChange={(e) =>
                      setFormData({ ...formData, interviewType: e.target.value as InterviewType })
                    }
                    className={`${INPUT_CLASS} appearance-none cursor-pointer`}
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
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100/50 flex gap-4 text-xs font-medium text-gray-500">
              {resumeDoc && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
                  <FileText size={12} className="text-lemonade-accent-hover" />
                  <span className="truncate max-w-[120px]">{resumeDoc.fileName}</span>
                </span>
              )}
              {jobPostDoc && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
                  <Briefcase size={12} className="text-lemonade-accent-hover" />
                  <span className="truncate max-w-[120px]">{jobPostDoc.fileName}</span>
                </span>
              )}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setStep('initial')}
                className="flex items-center justify-center gap-2 px-6 py-4 border border-gray-200 text-gray-600 font-bold text-sm rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
              >
                <ChevronLeft size={18} />
                Back
              </button>
              <button
                onClick={handleSetupNext}
                disabled={!isFormValid}
                className="flex-1 px-6 py-4 bg-lemonade-accent text-black font-bold text-sm rounded-2xl hover:bg-lemonade-accent-hover hover:shadow-lg hover:shadow-lemonade-accent/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.98]"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP: SELECTION ===== */}
      {step === 'selection' && (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
          <div className="mb-8 text-center">
            <p className="text-lg font-semibold text-black">{formData.title}</p>
            <p className="text-sm text-gray-500 mt-1">
              {formData.company} &middot; {formData.position} &middot; {formData.interviewType}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => handleSelectionClick('single')}
              className={`${BUTTON_CLASS} border-2 border-gray-200 bg-white text-black hover:border-lemonade-accent hover:shadow-md active:scale-95`}
            >
              one stage interview
            </button>
            <button
              onClick={() => handleSelectionClick('multi')}
              className={`${BUTTON_CLASS} border-2 border-gray-200 bg-white text-black hover:border-lemonade-accent hover:shadow-md active:scale-95`}
            >
              multi stage interview
            </button>
          </div>

          <button
            onClick={() => setStep('setup')}
            className="mt-6 flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors"
          >
            <ChevronLeft size={14} />
            back to details
          </button>
        </div>
      )}
    </div>
  );
};

export default Landing;
