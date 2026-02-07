import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertCircle, Loader2, Terminal, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore';

import { InterviewType } from '../../types';

const BUTTON_CLASS =
  'w-52 h-14 rounded-full font-semibold text-base tracking-wide transition-all duration-500 flex items-center justify-center';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { loadSettings } = useStore();
  const [step, setStep] = useState<'initial' | 'selection'>('initial');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  // Required Models
  const REQUIRED_MODELS = [
    { id: 'Llama-3.2-1B-Instruct-Hybrid', name: 'Llama 3.2 1B (LLM)' },
    { id: 'Whisper-Base', name: 'Whisper Base (ASR)' },
  ];

  useEffect(() => {
    performBackgroundChecks();
  }, []);

  const performBackgroundChecks = async () => {
    if (!window.electronAPI) {
      console.warn('Electron API not found - running in browser mode');
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setStartError(null);
    try {
      // 1. Check if lemonade-server is installed on the system
      const installation = await window.electronAPI.checkLemonadeInstallation();
      setLemonadeInstalled(installation.installed);

      if (!installation.installed) {
        setStartError(
          'Lemonade Server is not installed on this system. Download it from lemonade-server.ai to get started.'
        );
        setIsChecking(false);
        return;
      }

      // 2. Check if the server is actually running
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

  const handleBeginClick = () => {
    if (!isSystemReady && missingModels.length > 0) {
      // If models missing, don't advance, maybe shake or show modal
      // For this UI, we'll show the download prompt if they try to click begin
      return; 
    }
    setStep('selection');
  };

  const handleDashboardClick = () => {
    navigate('/dashboard');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('Resume uploaded:', file.name);
    }
  };

  const handleSelection = async (type: 'single' | 'multi') => {
    if (isStarting) return;
    setIsStarting(true);
    setStartError(null);
    
    try {
      if (!window.electronAPI) {
        // If in browser, we can't start the full electron interview process.
        // We should warn the user or redirect them if there's a web-only flow.
        throw new Error('Electron API not available. Please run the desktop application.');
      }

      // Create a default interview configuration based on selection
      const interviewConfig = {
        title: type === 'single' ? 'One Stage Interview' : 'Multi-Stage Interview',
        company: 'Nova Agent',
        position: 'Candidate',
        interviewType: (type === 'single' ? 'general' : 'behavioral') as InterviewType,
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

  return (
    <div className="h-screen w-full bg-lemonade-bg text-lemonade-fg overflow-hidden flex flex-col items-center justify-center relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Logo + Title */}
      <div className="flex flex-col items-center mb-16">
        <img
          src="/logo.png"
          alt="lemonade"
          className="w-20 h-20 mb-4 drop-shadow-lg"
        />
        <h1 className="text-3xl font-bold tracking-widest text-black">
          interviewer
        </h1>

        {/* Subtitle - selection step */}
        <p
          className={`mt-3 text-sm tracking-wide text-gray-500 transition-all duration-700 ${
            step === 'selection'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-2 pointer-events-none'
          }`}
        >
          select your interview process
        </p>
      </div>

      {/* Button Area */}
      <div className="relative flex flex-col items-center">
        {/* Primary Row: upload resume / begin / dashboard */}
        <div className="flex items-center gap-6">
          {/* upload resume */}
          <button
            onClick={handleUploadClick}
            className={`${BUTTON_CLASS} border-2 border-dashed border-gray-300 bg-white/60 text-gray-600 hover:border-lemonade-accent hover:text-black hover:bg-white ${
              step === 'selection'
                ? 'opacity-0 -translate-x-8 pointer-events-none'
                : 'opacity-100 translate-x-0'
            }`}
          >
            <Upload className="w-4 h-4 mr-2" />
            upload resume
          </button>

          {/* begin */}
          <button
            onClick={handleBeginClick}
            disabled={step === 'selection' || isChecking}
            className={`${BUTTON_CLASS} bg-lemonade-accent text-black shadow-md hover:bg-lemonade-accent-hover hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              step === 'selection' ? '-translate-y-10' : 'translate-y-0'
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
            className={`${BUTTON_CLASS} border-2 border-lemonade-accent bg-white text-black hover:bg-lemonade-bg hover:shadow-md active:scale-95 ${
              step === 'selection'
                ? 'opacity-0 translate-x-8 pointer-events-none'
                : 'opacity-100 translate-x-0'
            }`}
          >
            dashboard
          </button>
        </div>

        {/* Error / Status Message */}
        {startError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3 text-red-700 text-sm max-w-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="flex-shrink-0" />
              <p>{startError}</p>
            </div>

            {/* Show download link if not installed */}
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

            {/* Show start command if installed but not running */}
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

        {/* Selection Row: one stage / multi stage */}
        <div
          className={`flex items-center gap-6 mt-6 transition-all duration-700 delay-200 ${
            step === 'selection'
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8 pointer-events-none'
          }`}
        >
          <button
            onClick={() => handleSelection('single')}
            disabled={isStarting}
            className={`${BUTTON_CLASS} border-2 border-gray-200 bg-white text-black hover:border-lemonade-accent hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'one stage interview'}
          </button>

          <button
            onClick={() => handleSelection('multi')}
            disabled={isStarting}
            className={`${BUTTON_CLASS} border-2 border-gray-200 bg-white text-black hover:border-lemonade-accent hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'multi stage interview'}
          </button>
        </div>
      </div>

      {/* Missing Models Modal / Overlay — only show when server is running but models are missing */}
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
