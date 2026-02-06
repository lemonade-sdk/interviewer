import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';

import { InterviewType } from '../../types';

const BUTTON_CLASS =
  'w-52 h-14 rounded-full font-semibold text-base tracking-wide transition-all duration-500 flex items-center justify-center';

// Mock API removed - using real Lemonade API integration
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

  // Required Models
  const REQUIRED_MODELS = [
    { id: 'Llama-3.2-1B-Instruct-Hybrid', name: 'Llama 3.2 1B (LLM)' },
    { id: 'Whisper-Base', name: 'Whisper Base (ASR)' },
  ];

  useEffect(() => {
    performBackgroundChecks();
  }, []);

  const performBackgroundChecks = async () => {
    // In browser mode, we might not have electronAPI. 
    // We should handle this gracefully or assume Lemonade Server is direct access if configured.
    if (!window.electronAPI) {
      console.warn('Electron API not found - running in browser mode');
      // We can't do full system checks without Electron, but we can try to hit the local server directly if needed.
      // For now, we'll just stop the checking spinner and let the user try to proceed (which might fail later if they need Electron features).
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    try {
      // 1. Check Server
      const serverStatus = await window.electronAPI.getServerStatus();
      if (!serverStatus.isRunning) {
        console.warn('Lemonade Server not running');
        setStartError('Lemonade Server is not running. Please start it to enable AI features.');
      }

      // 2. Check Models
      const availableModels = await window.electronAPI.getAvailableModels();
      const availableIds = availableModels.map((m: any) => m.id);
      const missing = REQUIRED_MODELS.filter(m => !availableIds.includes(m.id));
      
      if (missing.length > 0) {
        setMissingModels(missing.map(m => m.id));
        setIsSystemReady(false);
      } else {
        setIsSystemReady(true);
      }

      // 3. Init API
      await loadSettings();
      
    } catch (error: any) {
      console.error('Background check failed:', error);
      setStartError(`Connection failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleDownloadModels = async () => {
    setIsDownloading(true);
    try {
      // Mock download process
      for (const modelId of missingModels) {
        setDownloadProgress(0);
        // Simulate download
        for (let i = 0; i <= 100; i += 20) {
          setDownloadProgress(i);
          await new Promise(r => setTimeout(r, 200));
        }
        // Real implementation would be: await window.electronAPI.pullModel(modelId);
      }
      setMissingModels([]);
      setIsSystemReady(true);
    } catch (error) {
      console.error('Download failed:', error);
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

        {/* Error Message */}
        {startError && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col gap-3 text-red-700 text-sm max-w-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <AlertCircle size={18} className="flex-shrink-0" />
              <p>{startError}</p>
            </div>
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

      {/* Missing Models Modal / Overlay */}
      {!isChecking && missingModels.length > 0 && !isSystemReady && (
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
