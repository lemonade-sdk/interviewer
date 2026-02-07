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
  'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-lemonade-accent focus:border-transparent transition-all bg-white';

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
      },
    });
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
                  ? 'bg-lemonade-accent text-black hover:bg-lemonade-accent-hover hover:shadow-lg'
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
        <div className="w-full max-w-md px-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-7 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="e.g., senior software engineer interview"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">company</label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="e.g., tech corp"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">position</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="e.g., senior software engineer"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">type</label>
                <select
                  value={formData.interviewType}
                  onChange={(e) =>
                    setFormData({ ...formData, interviewType: e.target.value as InterviewType })
                  }
                  className={INPUT_CLASS}
                >
                  <option value="general">general</option>
                  <option value="technical">technical</option>
                  <option value="behavioral">behavioral</option>
                  <option value="system-design">system design</option>
                  <option value="coding">coding</option>
                  <option value="mixed">mixed</option>
                </select>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3 text-xs text-gray-500">
              {resumeDoc && (
                <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-lg">
                  <FileText size={12} /> {resumeDoc.fileName}
                </span>
              )}
              {jobPostDoc && (
                <span className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 rounded-lg">
                  <Briefcase size={12} /> {jobPostDoc.fileName}
                </span>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setStep('initial')}
                className="flex items-center justify-center gap-1 flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold text-sm rounded-xl hover:bg-gray-50 transition-all"
              >
                <ChevronLeft size={16} />
                back
              </button>
              <button
                onClick={handleSetupNext}
                disabled={!isFormValid}
                className="flex-1 px-4 py-2.5 bg-lemonade-accent text-black font-semibold text-sm rounded-xl hover:bg-lemonade-accent-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                next
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
