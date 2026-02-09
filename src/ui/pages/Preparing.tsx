import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  FileText,
  Check,
  Download,
  Loader2,
  ChevronLeft,
  Star,
  HardDrive,
  Cpu,
  Zap,
  ArrowRight,
  User,
  Bot,
  Sparkles,
} from 'lucide-react';
import { InterviewType, CompatibleModel, UploadedDocument, AgentPersona, LoadedModel } from '../../types';

/* ────────────────────────────────────────────────────────────────────
   Route state passed from Landing
   ──────────────────────────────────────────────────────────────────── */
interface PreparingState {
  formData: {
    title: string;
    company: string;
    position: string;
    interviewType: InterviewType;
  };
  interviewMode: 'single' | 'multi';
  resumeDocId: string | null;
  resumeFileName: string | null;
  resumeBase64: string | null;
  jobPostDocId: string | null;
  jobPostFileName: string | null;
}

/* ────────────────────────────────────────────────────────────────────
   Download progress from SSE stream
   ──────────────────────────────────────────────────────────────────── */
interface DownloadProgress {
  file?: string;
  fileIndex?: number;
  totalFiles?: number;
  bytesDownloaded?: number;
  bytesTotal?: number;
  percent: number;
}

/* ────────────────────────────────────────────────────────────────────
   Phase of the preparation pipeline
   ──────────────────────────────────────────────────────────────────── */
type PrepPhase =
  | 'loading-list'
  | 'select'
  | 'downloading'
  | 'loading-model'
  | 'generating-persona'
  | 'starting'
  | 'error';

/* ────────────────────────────────────────────────────────────────────
   Sub-steps within persona generation for visual feedback
   ──────────────────────────────────────────────────────────────────── */
type PersonaGenStep =
  | 'analyzing-job'
  | 'analyzing-resume'
  | 'crafting-persona'
  | 'done';

/* ── helpers ───────────────────────────────────────────────────────── */

function sortModels(models: CompatibleModel[]): CompatibleModel[] {
  const score = (m: CompatibleModel) =>
    (m.suggested ? 2 : 0) + (m.downloaded ? 1 : 0);
  return [...models].sort((a, b) => score(b) - score(a));
}

function getLLMCandidates(models: CompatibleModel[]): CompatibleModel[] {
  return models.filter(
    m =>
      !m.labels.includes('audio') &&
      !m.labels.includes('embedding') &&
      !m.labels.includes('reranking') &&
      !m.labels.includes('image'),
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSize(sizeGB?: number): string {
  if (!sizeGB) return '';
  if (sizeGB < 1) return `${(sizeGB * 1024).toFixed(0)} MB`;
  return `${sizeGB.toFixed(1)} GB`;
}

/* ══════════════════════════════════════════════════════════════════════
   COMPONENT
   ══════════════════════════════════════════════════════════════════════ */

const Preparing: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as PreparingState | undefined;

  /* ── phase ── */
  const [phase, setPhase] = useState<PrepPhase>('loading-list');

  /* ── model catalogue ── */
  const [llmModels, setLlmModels] = useState<CompatibleModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  /* ── download ── */
  const [dlProgress, setDlProgress] = useState<DownloadProgress | null>(null);

  /* ── status / error ── */
  const [statusText, setStatusText] = useState('Fetching compatible models...');
  const [errorText, setErrorText] = useState<string | null>(null);

  /* ── resume preview ── */
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);

  /* ── persona generation ── */
  const [personaGenStep, setPersonaGenStep] = useState<PersonaGenStep>('analyzing-job');
  const [generatedPersona, setGeneratedPersona] = useState<AgentPersona | null>(null);
  const [jobAnalysis, setJobAnalysis] = useState<string | null>(null);
  const [resumeAnalysis, setResumeAnalysis] = useState<string | null>(null);

  /* ── guards ── */
  const didFetchRef = useRef(false);

  /* ── redirect if no state ── */
  useEffect(() => {
    if (!state) navigate('/', { replace: true });
  }, [state, navigate]);

  /* ── clean‑up blob URL ── */
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  /* ── clean‑up SSE listener ── */
  useEffect(() => {
    return () => {
      window.electronAPI?.offPullProgress?.();
    };
  }, []);

  /* ────────────────────────────────────────
     PDF preview builder
     ──────────────────────────────────────── */
  const buildPdfPreview = useCallback(async () => {
    const decode = (b64: string) => {
      const raw = atob(b64);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      return new Blob([arr], { type: 'application/pdf' });
    };
    if (state?.resumeBase64) {
      try { setPdfBlobUrl(URL.createObjectURL(decode(state.resumeBase64))); return; } catch { /* noop */ }
    }
    if (state?.resumeDocId && window.electronAPI) {
      try {
        const d = await window.electronAPI.getDocumentFileData(state.resumeDocId);
        if (d?.mimeType === 'application/pdf') setPdfBlobUrl(URL.createObjectURL(decode(d.base64)));
      } catch { /* noop */ }
    }
  }, [state]);

  const loadResumeText = useCallback(async () => {
    if (!state?.resumeDocId || !window.electronAPI) return;
    try {
      const doc: UploadedDocument | null = await window.electronAPI.getDocument(state.resumeDocId);
      if (doc?.extractedText) setResumeText(doc.extractedText);
    } catch { /* non-critical */ }
  }, [state]);

  /* ────────────────────────────────────────
     Step 1  —  Fetch model list on mount
     ──────────────────────────────────────── */
  useEffect(() => {
    if (!state || didFetchRef.current) return;
    didFetchRef.current = true;
    buildPdfPreview();
    loadResumeText();

    (async () => {
      if (!window.electronAPI) {
        setPhase('starting'); setStatusText('Ready!');
        await new Promise(r => setTimeout(r, 600));
        navigate('/dashboard', { replace: true });
        return;
      }
      try {
        setStatusText('Fetching compatible models...');
        const all = await window.electronAPI.listAllModels();
        const llms = sortModels(getLLMCandidates(all));
        if (llms.length === 0) {
          setPhase('error');
          setErrorText('No compatible LLM models found. Ensure Lemonade Server is running.');
          return;
        }
        setLlmModels(llms);
        const best =
          llms.find(m => m.suggested && m.downloaded) ||
          llms.find(m => m.suggested) ||
          llms.find(m => m.downloaded) ||
          llms[0];
        setSelectedModelId(best.id);
        setPhase('select');
      } catch (e: any) {
        setPhase('error');
        setErrorText(e.message || 'Failed to fetch model list.');
      }
    })();
  }, [state, navigate, buildPdfPreview, loadResumeText]);

  /* ────────────────────────────────────────
     Step 2  —  User clicks "Continue"
     ──────────────────────────────────────── */
  const handleContinue = useCallback(async () => {
    if (!state || !selectedModelId || !window.electronAPI) return;
    const model = llmModels.find(m => m.id === selectedModelId);
    if (!model) return;
    setErrorText(null);

    try {
      /* ════════════════════════════════════════════════════════════
         SMART MODEL MANAGEMENT
         Before loading anything, check what's already loaded on the
         server to avoid redundant loads and prevent multi-loading.
         Only ONE LLM and ONE ASR model should ever be active.
         ════════════════════════════════════════════════════════════ */

      // Query current server state to see what's already loaded
      // and what model types the server supports (max_models)
      let loadedModels: LoadedModel[] = [];
      let serverSupportsAudio = false;
      try {
        const health = await window.electronAPI.getServerHealth();
        loadedModels = health?.all_models_loaded ?? [];
        // Check if the server has an audio slot (some configs don't support audio at all)
        const maxModels = (health as any)?.max_models;
        serverSupportsAudio = maxModels?.audio != null && maxModels.audio > 0;
        console.log('Currently loaded models:', loadedModels.map(m => `${m.model_name} (${m.type})`));
        console.log('Server supports audio models:', serverSupportsAudio, '| max_models:', maxModels);
      } catch {
        console.warn('Could not query server health, will proceed with fresh loads');
      }

      const loadedLLM = loadedModels.find(m => m.type === 'llm');
      const loadedASR = loadedModels.find(m => m.type === 'audio');

      /* ── download selected LLM if needed ── */
      if (!model.downloaded) {
        setPhase('downloading');
        setDlProgress({ percent: 0 });
        setStatusText(`Downloading ${model.id}...`);

        window.electronAPI.onPullProgress((data: DownloadProgress) => setDlProgress(data));
        const pull = await window.electronAPI.pullModelStreaming(model.id);
        window.electronAPI.offPullProgress();

        if (pull === false || (pull && !pull.success)) {
          setPhase('error');
          setErrorText(`Download failed: ${pull && pull.message ? pull.message : 'Unknown error'}`);
          return;
        }
        model.downloaded = true;
        setLlmModels(prev => prev.map(m => m.id === model.id ? { ...m, downloaded: true } : m));
      }

      /* ── load LLM (smart: skip if already active, unload stale if different) ── */
      setPhase('loading-model');

      if (loadedLLM && loadedLLM.model_name === model.id) {
        // The correct LLM is already loaded — skip loading entirely
        console.log(`LLM ${model.id} is already loaded, skipping load`);
        setStatusText(`${model.id} already active`);
        await new Promise(r => setTimeout(r, 300)); // Brief visual acknowledgment
      } else {
        // Unload any stale LLM first to free memory (only 1 LLM should be active)
        if (loadedLLM) {
          setStatusText(`Unloading ${loadedLLM.model_name}...`);
          console.log(`Unloading stale LLM: ${loadedLLM.model_name}`);
          try {
            await window.electronAPI.unloadModel(loadedLLM.model_name);
          } catch (unloadErr) {
            console.warn('Failed to unload stale LLM (non-fatal):', unloadErr);
          }
        }

        // Load the selected LLM with an expanded context window.
        // The persona generation prompt needs ~5-6K tokens (JD + resume + instructions + output),
        // and the default 4096 is too small.  Request 16384 so there's ample room for both
        // persona generation and multi-turn interview conversations.
        setStatusText(`Loading ${model.id}...`);
        const opts: Record<string, any> = { ctx_size: 16384 };
        if (model.recipe === 'llamacpp') {
          opts.llamacpp_backend = 'vulkan';
        }
        const load = await window.electronAPI.loadModel(model.id, opts);
        if (load === false || (load && !load.success)) {
          setPhase('error');
          setErrorText(`Load failed: ${load && load.message ? load.message : 'Unknown error'}`);
          return;
        }
      }

      /* ── configure ASR (Whisper) — smart load ── */
      // Only attempt ASR setup if the server actually supports audio models.
      // The server's max_models must have an `audio` slot; without it, loading
      // Whisper will 500. Voice features are optional — text interview works fine.
      let bestASR: CompatibleModel | null = null;

      if (serverSupportsAudio) {
        setStatusText('Preparing speech recognition...');
        const allNow = await window.electronAPI.listAllModels();
        const asrs = allNow.filter(m => m.labels.includes('audio'));
        bestASR =
          asrs.find(m => m.suggested && m.downloaded) ||
          asrs.find(m => m.suggested) ||
          asrs.find(m => m.downloaded) ||
          asrs[0] || null;

        if (bestASR) {
          // Download the ASR model if not already available
          if (!bestASR.downloaded) {
            setStatusText(`Downloading ${bestASR.id} for speech recognition...`);
            window.electronAPI.onPullProgress((data: DownloadProgress) => setDlProgress(data));
            const asrPull = await window.electronAPI.pullModelStreaming(bestASR.id);
            window.electronAPI.offPullProgress();

            if (asrPull === false || (asrPull && !asrPull.success)) {
              console.warn('ASR model download failed, voice features may not work:', asrPull);
            } else {
              bestASR.downloaded = true;
            }
          }

          // Load the ASR model (smart: skip if already active, unload stale if different)
          if (bestASR.downloaded) {
            if (loadedASR && loadedASR.model_name === bestASR.id) {
              console.log(`ASR model ${bestASR.id} is already loaded, skipping load`);
            } else {
              if (loadedASR) {
                console.log(`Unloading stale ASR: ${loadedASR.model_name}`);
                try {
                  await window.electronAPI.unloadModel(loadedASR.model_name);
                } catch (unloadErr) {
                  console.warn('Failed to unload stale ASR (non-fatal):', unloadErr);
                }
              }

              setStatusText(`Loading ${bestASR.id}...`);
              const asrLoad = await window.electronAPI.loadModel(bestASR.id);
              if (asrLoad === false || (asrLoad && !asrLoad.success)) {
                console.warn('ASR model load failed, voice features may not work:', asrLoad);
              } else {
                console.log(`ASR model ${bestASR.id} loaded successfully`);
              }
            }
          }
        }
      } else {
        console.log('Server does not support audio models (no audio slot in max_models). Skipping ASR setup — voice features disabled, text interview available.');
      }

      await window.electronAPI.updateInterviewerSettings({ modelName: model.id, asrModel: bestASR?.id });

      /* ════════════════════════════════════════════════════════════
         PERSONA GENERATION PHASE
         The AI reads the job description, then the resume,
         then synthesizes an interviewer persona.
         ════════════════════════════════════════════════════════════ */
      setPhase('generating-persona');
      setPersonaGenStep('analyzing-job');
      setStatusText('Analyzing job description...');

      // Fetch both documents' extracted text
      let jobText = '';
      let resumeDocText = '';

      if (state.jobPostDocId) {
        const jobDoc = await window.electronAPI.getDocument(state.jobPostDocId);
        jobText = jobDoc?.extractedText || '';
      }

      if (state.resumeDocId) {
        const resumeDoc = await window.electronAPI.getDocument(state.resumeDocId);
        resumeDocText = resumeDoc?.extractedText || '';
      }

      // Visual step progression (the actual generation is one LLM call,
      // but we show incremental steps for user feedback)
      await new Promise(r => setTimeout(r, 800));
      setPersonaGenStep('analyzing-resume');
      setStatusText('Analyzing your resume...');
      await new Promise(r => setTimeout(r, 800));
      setPersonaGenStep('crafting-persona');
      setStatusText('Crafting interviewer persona...');

      let personaId: string | undefined;

      if (jobText && resumeDocText) {
        try {
          const result = await window.electronAPI.generatePersona({
            jobDescriptionText: jobText,
            resumeText: resumeDocText,
            interviewType: state.interviewMode === 'single'
              ? state.formData.interviewType
              : 'behavioral',
            company: state.formData.company,
            position: state.formData.position,
          });

          setGeneratedPersona(result.persona);
          setJobAnalysis(result.jobAnalysis);
          setResumeAnalysis(result.resumeAnalysis);
          personaId = result.persona.id;
        } catch (personaErr: any) {
          console.warn('Persona generation failed, proceeding with default prompt:', personaErr);
          // Non-fatal: continue without a persona
        }
      }

      setPersonaGenStep('done');
      setStatusText('Persona ready!');
      await new Promise(r => setTimeout(r, 500));

      /* ── start interview ── */
      setPhase('starting');
      setStatusText('Starting interview...');
      const interview = await window.electronAPI.startInterview(
        {
          title: state.formData.title,
          company: state.formData.company,
          position: state.formData.position,
          interviewType:
            state.interviewMode === 'single'
              ? state.formData.interviewType
              : ('behavioral' as InterviewType),
        },
        personaId,
      );
      if (!interview) { setPhase('error'); setErrorText('Failed to create interview.'); return; }

      setStatusText('Ready!');
      await new Promise(r => setTimeout(r, 350));
      navigate(`/interview/${interview.id}`, { replace: true });
    } catch (e: any) {
      console.error('Preparation failed:', e);
      setPhase('error');
      setErrorText(e.message || 'An unexpected error occurred.');
    }
  }, [state, selectedModelId, llmModels, navigate]);

  /* ────────────────── guard ──────────────── */
  if (!state) return null;

  const selectedModel = llmModels.find(m => m.id === selectedModelId) || null;
  const isWorking = phase === 'downloading' || phase === 'loading-model' || phase === 'generating-persona' || phase === 'starting';

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="h-screen w-full bg-lemonade-bg text-lemonade-fg flex flex-col overflow-hidden">

      {/* ═══════ TOP BAR ═══════ */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-black/5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            title="Back"
          >
            <ChevronLeft size={18} className="text-gray-500" />
          </button>
          <div>
            <h1 className="text-base font-bold text-black leading-tight">
              Prepare for your interview
            </h1>
            <p className="text-[11px] text-gray-400 mt-0.5 tracking-wide">
              {state.formData.title} &middot; {state.formData.company} &middot; {state.formData.position}
            </p>
          </div>
        </div>

        {selectedModel && isWorking && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 backdrop-blur-sm border border-black/5 rounded-full">
            <Cpu size={12} className="text-lemonade-accent-hover" />
            <span className="text-[11px] font-semibold text-gray-600">{selectedModel.id}</span>
          </div>
        )}
      </header>

      {/* ═══════ MAIN ═══════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Resume viewer ─── */}
        <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-lemonade-bg via-white/40 to-lemonade-bg">
          {pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full rounded-2xl border border-black/5 shadow-lg bg-white"
              title="Resume Preview"
            />
          ) : resumeText ? (
            <div className="w-full max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-3 text-gray-400">
                <FileText size={16} />
                <span className="text-xs font-medium">{state.resumeFileName}</span>
              </div>
              <div className="bg-white rounded-2xl border border-black/5 p-6 max-h-[75vh] overflow-y-auto shadow-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{resumeText}</p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-300 select-none">
              <FileText size={56} className="mx-auto mb-4 opacity-40" />
              <p className="text-sm font-medium text-gray-400">{state.resumeFileName || 'Your resume'}</p>
              <p className="text-xs text-gray-300 mt-1">Review while we get things ready</p>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Panel ─── */}
        <aside className="w-[420px] border-l border-black/5 bg-white flex flex-col">

          {/* ── loading list ── */}
          {phase === 'loading-list' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-lemonade-accent/15 flex items-center justify-center">
                  <Loader2 size={22} className="animate-spin text-lemonade-accent-hover" />
                </div>
              </div>
              <p className="text-sm text-gray-400 font-medium">{statusText}</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              SELECT PHASE — the model catalogue
             ══════════════════════════════════════════════ */}
          {phase === 'select' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* header */}
              <div className="px-7 pt-7 pb-4">
                <h2 className="text-[13px] font-bold text-black uppercase tracking-widest">
                  Choose a model
                </h2>
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                  Pick the AI model that will power your interview.
                  Models marked <span className="text-green-500 font-semibold">ready</span> are
                  already on your machine.
                </p>
              </div>

              {/* scrollable list */}
              <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2">
                {llmModels.map(model => {
                  const selected = model.id === selectedModelId;
                  return (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={`
                        group w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all duration-200
                        ${selected
                          ? 'border-lemonade-accent bg-lemonade-accent/[0.06] shadow-sm'
                          : 'border-transparent bg-gray-50/80 hover:bg-gray-50 hover:border-gray-200'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between gap-3">
                        {/* radio dot */}
                        <div className={`
                          flex-shrink-0 w-[18px] h-[18px] rounded-full border-2 transition-all duration-200
                          flex items-center justify-center
                          ${selected
                            ? 'border-lemonade-accent'
                            : 'border-gray-300 group-hover:border-gray-400'
                          }
                        `}>
                          {selected && (
                            <div className="w-2.5 h-2.5 rounded-full bg-lemonade-accent" />
                          )}
                        </div>

                        {/* info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
                            {model.id}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {model.suggested && (
                              <span className="inline-flex items-center gap-[3px] text-[9px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-1.5 py-[2px] rounded-md">
                                <Star size={8} className="fill-amber-400" />
                                Suggested
                              </span>
                            )}
                            {model.labels.filter(l => l !== 'llm').map(l => (
                              <span key={l} className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-[2px] rounded-md">
                                {l}
                              </span>
                            ))}
                            {model.recipe && (
                              <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-[2px] rounded-md">
                                {model.recipe}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* right: size + status */}
                        <div className="flex-shrink-0 flex flex-col items-end gap-1">
                          {model.size ? (
                            <span className="text-[10px] font-semibold text-gray-400">
                              {formatSize(model.size)}
                            </span>
                          ) : null}
                          {model.downloaded ? (
                            <span className="inline-flex items-center gap-[3px] text-[9px] font-bold text-green-600 bg-green-50 px-2 py-[2px] rounded-md">
                              <HardDrive size={8} />
                              Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-[3px] text-[9px] font-bold text-gray-400 bg-gray-100 px-2 py-[2px] rounded-md">
                              <Download size={8} />
                              Download
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* action bar */}
              <div className="px-5 py-5 border-t border-black/5">
                <button
                  onClick={handleContinue}
                  disabled={!selectedModelId}
                  className="
                    w-full flex items-center justify-center gap-2.5 px-5 py-3.5
                    bg-lemonade-accent text-black font-bold text-[13px] rounded-2xl
                    hover:bg-lemonade-accent-hover hover:text-white
                    active:scale-[0.98]
                    disabled:opacity-30 disabled:cursor-not-allowed
                    transition-all duration-200 shadow-sm
                  "
                >
                  {selectedModel && !selectedModel.downloaded ? (
                    <>
                      <Download size={15} />
                      Download &amp; Start Interview
                    </>
                  ) : (
                    <>
                      <ArrowRight size={15} />
                      Start Interview
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              DOWNLOADING PHASE
             ══════════════════════════════════════════════ */}
          {phase === 'downloading' && (
            <div className="flex-1 flex flex-col px-8 pt-10">
              {/* icon */}
              <div className="w-14 h-14 rounded-2xl bg-lemonade-accent/15 flex items-center justify-center mb-6">
                <Download size={24} className="text-lemonade-accent-hover animate-bounce" />
              </div>

              <h2 className="text-sm font-bold text-black uppercase tracking-widest mb-1">
                Downloading
              </h2>
              <p className="text-[13px] font-semibold text-gray-700 mb-5">{selectedModel?.id}</p>

              {/* progress bar */}
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-lemonade-accent to-lemonade-accent-hover rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${dlProgress?.percent ?? 0}%` }}
                />
                {/* shimmer overlay */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse rounded-full"
                  style={{ animationDuration: '2s' }}
                />
              </div>

              {/* stats row */}
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-400">
                  {dlProgress?.bytesDownloaded != null && dlProgress?.bytesTotal != null
                    ? `${formatBytes(dlProgress.bytesDownloaded)} / ${formatBytes(dlProgress.bytesTotal)}`
                    : 'Preparing...'}
                </span>
                <span className="text-lg font-bold text-black tabular-nums">
                  {dlProgress?.percent ?? 0}<span className="text-xs font-semibold text-gray-400">%</span>
                </span>
              </div>

              {dlProgress?.file && (
                <p className="text-[10px] text-gray-300 truncate mt-2">
                  {dlProgress.file}
                  {dlProgress.totalFiles && dlProgress.totalFiles > 1
                    ? ` (file ${dlProgress.fileIndex} of ${dlProgress.totalFiles})`
                    : ''}
                </p>
              )}

              <p className="text-[11px] text-gray-300 mt-auto pb-6">
                Review your resume while the model downloads.
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              LOADING MODEL PHASE
             ══════════════════════════════════════════════ */}
          {phase === 'loading-model' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-lemonade-accent/15 flex items-center justify-center">
                  <Zap size={28} className="text-lemonade-accent-hover" />
                </div>
                {/* spinning ring */}
                <div className="absolute -inset-2 rounded-[22px] border-2 border-lemonade-accent/20 border-t-lemonade-accent animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-black">{statusText}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Warming up the model — this can take a moment
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              GENERATING PERSONA PHASE
             ══════════════════════════════════════════════ */}
          {phase === 'generating-persona' && (
            <div className="flex-1 flex flex-col px-8 pt-10">
              {/* icon */}
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center mb-6">
                <Sparkles size={24} className="text-purple-600" />
              </div>

              <h2 className="text-sm font-bold text-black uppercase tracking-widest mb-1">
                Preparing Your Interview
              </h2>
              <p className="text-[11px] text-gray-400 mb-6 leading-relaxed">
                The AI is reading your documents and crafting a personalized interviewer.
              </p>

              {/* Step indicators */}
              <div className="space-y-4">
                {/* Step 1: Analyzing Job */}
                <div className="flex items-start gap-3">
                  <div className={`
                    flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500
                    ${personaGenStep === 'analyzing-job'
                      ? 'bg-lemonade-accent/20'
                      : 'bg-green-50'
                    }
                  `}>
                    {personaGenStep === 'analyzing-job' ? (
                      <Loader2 size={14} className="animate-spin text-lemonade-accent-hover" />
                    ) : (
                      <Check size={14} className="text-green-500" />
                    )}
                  </div>
                  <div className="pt-1">
                    <p className={`text-[13px] font-semibold transition-colors duration-300 ${
                      personaGenStep === 'analyzing-job' ? 'text-black' : 'text-green-600'
                    }`}>
                      Reading job description
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Understanding role requirements, skills, and expectations
                    </p>
                    {jobAnalysis && personaGenStep !== 'analyzing-job' && (
                      <p className="text-[10px] text-gray-500 mt-1.5 bg-gray-50 rounded-lg p-2 leading-relaxed">
                        {jobAnalysis}
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 2: Analyzing Resume */}
                <div className="flex items-start gap-3">
                  <div className={`
                    flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500
                    ${personaGenStep === 'analyzing-resume'
                      ? 'bg-lemonade-accent/20'
                      : personaGenStep === 'analyzing-job'
                        ? 'bg-gray-100'
                        : 'bg-green-50'
                    }
                  `}>
                    {personaGenStep === 'analyzing-resume' ? (
                      <Loader2 size={14} className="animate-spin text-lemonade-accent-hover" />
                    ) : personaGenStep === 'analyzing-job' ? (
                      <User size={14} className="text-gray-300" />
                    ) : (
                      <Check size={14} className="text-green-500" />
                    )}
                  </div>
                  <div className="pt-1">
                    <p className={`text-[13px] font-semibold transition-colors duration-300 ${
                      personaGenStep === 'analyzing-resume'
                        ? 'text-black'
                        : personaGenStep === 'analyzing-job'
                          ? 'text-gray-300'
                          : 'text-green-600'
                    }`}>
                      Analyzing your resume
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Mapping your experience to the role requirements
                    </p>
                    {resumeAnalysis && (personaGenStep === 'crafting-persona' || personaGenStep === 'done') && (
                      <p className="text-[10px] text-gray-500 mt-1.5 bg-gray-50 rounded-lg p-2 leading-relaxed">
                        {resumeAnalysis}
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 3: Crafting Persona */}
                <div className="flex items-start gap-3">
                  <div className={`
                    flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500
                    ${personaGenStep === 'crafting-persona'
                      ? 'bg-purple-100'
                      : personaGenStep === 'done'
                        ? 'bg-green-50'
                        : 'bg-gray-100'
                    }
                  `}>
                    {personaGenStep === 'crafting-persona' ? (
                      <Loader2 size={14} className="animate-spin text-purple-500" />
                    ) : personaGenStep === 'done' ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <Bot size={14} className="text-gray-300" />
                    )}
                  </div>
                  <div className="pt-1">
                    <p className={`text-[13px] font-semibold transition-colors duration-300 ${
                      personaGenStep === 'crafting-persona'
                        ? 'text-black'
                        : personaGenStep === 'done'
                          ? 'text-green-600'
                          : 'text-gray-300'
                    }`}>
                      Crafting interviewer persona
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Building a tailored interviewer for this specific role
                    </p>
                    {generatedPersona && personaGenStep === 'done' && (
                      <div className="mt-2 bg-purple-50/80 border border-purple-100 rounded-xl p-3">
                        <p className="text-[12px] font-bold text-purple-800">{generatedPersona.name}</p>
                        <p className="text-[10px] text-purple-600 mt-0.5 leading-relaxed">{generatedPersona.description}</p>
                        <div className="flex gap-1.5 mt-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-purple-500 bg-purple-100 px-1.5 py-[2px] rounded-md">
                            {generatedPersona.interviewStyle}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-widest text-purple-500 bg-purple-100 px-1.5 py-[2px] rounded-md">
                            {generatedPersona.questionDifficulty}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-gray-300 mt-auto pb-6">
                This ensures your interview is tailored to the exact role and your background.
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              STARTING PHASE
             ══════════════════════════════════════════════ */}
          {phase === 'starting' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
              <div className="w-16 h-16 rounded-3xl bg-green-50 flex items-center justify-center">
                <Check size={30} className="text-green-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-black">{statusText}</p>
                <p className="text-[11px] text-gray-400 mt-1">You're almost there</p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              ERROR PHASE
             ══════════════════════════════════════════════ */}
          {phase === 'error' && (
            <div className="flex-1 flex flex-col justify-center px-7">
              <div className="bg-red-50/80 border border-red-200/60 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <AlertCircle size={16} className="text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-red-800 mb-1">Something went wrong</p>
                    <p className="text-xs text-red-600/80 whitespace-pre-wrap leading-relaxed">{errorText}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4 ml-11">
                  <button
                    onClick={() => { setErrorText(null); setPhase('select'); }}
                    className="px-4 py-2 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 rounded-xl transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    Go back
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Preparing;
