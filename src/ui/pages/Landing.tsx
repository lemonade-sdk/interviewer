import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Terminal, ExternalLink, ChevronLeft, FileText, Briefcase, Check } from 'lucide-react';
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
  
  // System Check State
  const [isSystemReady, setIsSystemReady] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [missingModels, setMissingModels] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Lemonade Installation State
  const [lemonadeInstalled, setLemonadeInstalled] = useState<boolean | null>(null);
  const [serverRunning, setServerRunning] = useState(false);

  // Document Upload State
  const [resumeDoc, setResumeDoc] = useState<UploadedDocument | null>(null);
  const [jobPostDoc, setJobPostDoc] = useState<UploadedDocument | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isUploadingJobPost, setIsUploadingJobPost] = useState(false);

  // Interview Setup Form
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    position: '',
    interviewType: 'general' as InterviewType,
  });

  // Required Models
  const REQUIRED_MODELS = [
    { id: 'Llama-3.2-1B-Instruct-Hybrid', name: 'Llama 3.2 1B (LLM)' },
    { id: 'Whisper-Base', name: 'Whisper Base (ASR)' },
  ];

  const bothDocsUploaded = resumeDoc !== null && jobPostDoc !== null;

  useEffect(() => {
    performBackgroundChecks();
  }, []);

  const performBackgroundChecks = async () => {
    if (!window.electronAPI) {
      console.info('Running in browser mode — Electron API not available');
      setLemonadeInstalled(true);
      setServerRunning(true);
      setIsSystemReady(true);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setStartError(null);
    try {
      // 1. Check if lemonade-server is installed
      const installation = await window.electronAPI.checkLemonadeInstallation();
      setLemonadeInstalled(installation.installed);

      if (!installation.installed) {
        setStartError(
          'Lemonade Server is not installed on this system. Download it from lemonade-server.ai to get started.'
        );
        setIsChecking(false);
        return;
      }

      // 2. Check if the server is running
      const serverStatus = await window.electronAPI.getServerStatus();
      setServerRunning(serverStatus.isRunning);

      if (!serverStatus.isRunning) {
        setStartError(
          'Lemonade Server is installed but not running. Start it with: lemonade-server serve'
        );
        setIsChecking(false);
        return;
      }

      // 3. Check available models
      const availableModels = await window.electronAPI.getAvailableModels();
      const availableIds = availableModels.map((m: any) => m.id);
      const missing = REQUIRED_MODELS.filter(m => !availableIds.includes(m.id));
      
      if (missing.length > 0) {
        setMissingModels(missing.map(m => m.id));
        setIsSystemReady(false);
      } else {
        setIsSystemReady(true);
      }

      // 4. Load settings
      await loadSettings();
      
    } catch (error: any) {
      console.error('Background check failed:', error);
      setStartError(`Connection failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownloadModels = async () => {
    if (!window.electronAPI) return;
    setIsDownloading(true);
    try {
      for (const modelId of missingModels) {
        setDownloadProgress(0);
        await window.electronAPI.pullModel(modelId);
        setDownloadProgress(100);
      }
      setMissingModels([]);
      setIsSystemReady(true);
    } catch (error) {
      console.error('Download failed:', error);
      setStartError('Failed to download models. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get pure base64
        const base64 = result.split(',')[1];
        resolve(base64);
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
        const doc = await window.electronAPI.uploadDocument({
          type: 'resume',
          fileName: file.name,
          fileData,
        });
        setResumeDoc(doc);
        console.log('Resume uploaded and parsed:', doc.fileName, `(${doc.extractedText.length} chars extracted)`);
      } catch (error) {
        console.error('Failed to upload resume:', error);
        setStartError('Failed to upload resume. Please try again.');
      } finally {
        setIsUploadingResume(false);
      }
    } else {
      // Browser mode — just track the file name
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
    // Reset input so same file can be re-selected
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
        console.log('Job post uploaded and parsed:', doc.fileName, `(${doc.extractedText.length} chars extracted)`);
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

  const handleBeginClick = () => {
    if (!bothDocsUploaded) return;
    if (!isSystemReady && missingModels.length > 0) return;
    setStep('setup');
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  const handleSetupNext = () => {
    if (!formData.title.trim() || !formData.company.trim() || !formData.position.trim()) {
      return;
    }
    setStep('selection');
  };

  const handleStartInterview = async (type: 'single' | 'multi') => {
    if (isStarting) return;
    setIsStarting(true);
    setStartError(null);
    
    try {
      if (!window.electronAPI) {
        console.info('Browser mode: redirecting to dashboard');
        navigate('/dashboard');
        return;
      }

      const interviewConfig = {
        title: formData.title,
        company: formData.company,
        position: formData.position,
        interviewType: (type === 'single' ? formData.interviewType : 'behavioral') as InterviewType,
      };

      const interview = await window.electronAPI.startInterview(interviewConfig);
      if (!interview) {
        throw new Error('Failed to create interview session.');
      }
      navigate(`/interview/${interview.id}`);
    } catch (error: any) {
      console.error('Failed to start interview:', error);
      setStartError(error.message || 'An unexpected error occurred.');
      setIsStarting(false);
    }
  };

  const isFormValid = formData.title.trim() && formData.company.trim() && formData.position.trim();

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
        <h1 className="text-3xl font-bold tracking-widest text-black">
          interviewer
        </h1>

        {/* Subtitle */}
        <p
          className={`mt-3 text-sm tracking-wide text-gray-500 transition-all duration-700 ${
            step !== 'initial'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          {step === 'setup' ? 'set up your interview' : step === 'selection' ? 'select your interview process' : ''}
        </p>
      </div>

      {/* ===== STEP: INITIAL ===== */}
      {step === 'initial' && (
        <div className="flex flex-col items-center">
          {/* Upload Areas */}
          <div className="flex items-center gap-6 mb-8">
            {/* Upload Resume */}
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

            {/* Upload Job Post */}
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
            {/* begin — white until both docs uploaded, then yellow */}
            <button
              onClick={handleBeginClick}
              disabled={!bothDocsUploaded || isChecking}
              className={`${BUTTON_CLASS} shadow-md active:scale-95 disabled:cursor-not-allowed transition-all duration-500 ${
                bothDocsUploaded && !isChecking
                  ? 'bg-lemonade-accent text-black hover:bg-lemonade-accent-hover hover:shadow-lg'
                  : 'bg-white text-gray-400 border-2 border-gray-200'
              }`}
            >
              {isChecking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                'begin'
              )}
            </button>

            {/* dashboard */}
            <button
              onClick={handleDashboardClick}
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

          {/* Error / Status Message */}
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
                  <p className="text-xs text-gray-500">
                    After installing, restart this application.
                  </p>
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

      {/* ===== STEP: SETUP (Interview Details Form) ===== */}
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

            {/* Uploaded docs summary */}
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

      {/* ===== STEP: SELECTION (One Stage / Multi Stage) ===== */}
      {step === 'selection' && (
        <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
          {/* Interview summary */}
          <div className="mb-8 text-center">
            <p className="text-lg font-semibold text-black">{formData.title}</p>
            <p className="text-sm text-gray-500 mt-1">
              {formData.company} &middot; {formData.position} &middot; {formData.interviewType}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => handleStartInterview('single')}
              disabled={isStarting}
              className={`${BUTTON_CLASS} border-2 border-gray-200 bg-white text-black hover:border-lemonade-accent hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'one stage interview'}
            </button>

            <button
              onClick={() => handleStartInterview('multi')}
              disabled={isStarting}
              className={`${BUTTON_CLASS} border-2 border-gray-200 bg-white text-black hover:border-lemonade-accent hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'multi stage interview'}
            </button>
          </div>

          <button
            onClick={() => setStep('setup')}
            disabled={isStarting}
            className="mt-6 flex items-center gap-1 text-sm text-gray-500 hover:text-black transition-colors disabled:opacity-50"
          >
            <ChevronLeft size={14} />
            back to details
          </button>

          {startError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm max-w-lg">
              <AlertCircle size={16} className="flex-shrink-0" />
              <p>{startError}</p>
            </div>
          )}
        </div>
      )}

      {/* Missing Models Modal */}
      {!isChecking && lemonadeInstalled && serverRunning && missingModels.length > 0 && !isSystemReady && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 text-center">
            <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-black mb-2">Setup Required</h2>
            <p className="text-gray-600 mb-6">
              To use Nova Agent, we need to download {missingModels.length} AI models to your device.
            </p>
            
            {isDownloading ? (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-gray-500">
                  <span>Downloading...</span>
                  <span>{downloadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-lemonade-accent transition-all duration-300" 
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleDownloadModels}
                className="w-full py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors"
              >
                Download Models
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
