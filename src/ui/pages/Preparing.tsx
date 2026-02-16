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
import { InterviewType, InterviewStyle, CompatibleModel, UploadedDocument, AgentPersona, LoadedModel } from '../../types';
import { LemonSelect } from '../components/lemon/LemonSelect';

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
  | 'error';

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

  const [phase, setPhase] = useState<PrepPhase>('loading-list');
  const [llmModels, setLlmModels] = useState<CompatibleModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [dlProgress, setDlProgress] = useState<DownloadProgress | null>(null);
  const [statusText, setStatusText] = useState('Fetching compatible models...');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);
  const [personaGenStep, setPersonaGenStep] = useState<PersonaGenStep>('analyzing-job');
  const [generatedPersona, setGeneratedPersona] = useState<AgentPersona | null>(null);
  const [jobAnalysis, setJobAnalysis] = useState<string | null>(null);
  const [resumeAnalysis, setResumeAnalysis] = useState<string | null>(null);
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyle>('conversational');
  const [questionDifficulty, setQuestionDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const didFetchRef = useRef(false);

  useEffect(() => {
    if (!state) navigate('/', { replace: true });
  }, [state, navigate]);

  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  useEffect(() => {
    return () => {
      window.electronAPI?.offPullProgress?.();
    };
  }, []);

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- setState runs in queueMicrotask callback, not sync
  useEffect(() => {
    if (!state || didFetchRef.current) return;
    didFetchRef.current = true;
    buildPdfPreview();
    loadResumeText();

    void queueMicrotask(async () => {
      if (!window.electronAPI) {
        setPhase('generating-persona'); setPersonaGenStep('done'); setStatusText('Ready!');
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
    });
  }, [state, navigate, buildPdfPreview, loadResumeText]);

  const handleContinue = useCallback(async () => {
    if (!state || !selectedModelId || !window.electronAPI) return;
    const model = llmModels.find(m => m.id === selectedModelId);
    if (!model) return;
    setErrorText(null);

    try {
      let loadedModels: LoadedModel[] = [];
      let serverSupportsAudio = false;
      try {
        const health = await window.electronAPI.getServerHealth();
        loadedModels = health?.all_models_loaded ?? [];
        const maxModels = health?.max_models;
        const hasAudioSlot = maxModels?.audio != null ? maxModels.audio > 0 : true;
        const hasLoadedAudio = loadedModels.some(m => m.type === 'audio');
        serverSupportsAudio = hasAudioSlot || hasLoadedAudio;
      } catch {
        console.warn('Could not query server health, will proceed with fresh loads');
      }

      const loadedLLM = loadedModels.find(m => m.type === 'llm');
      const loadedASR = loadedModels.find(m => m.type === 'audio');

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

      setPhase('loading-model');

      if (loadedLLM && loadedLLM.model_name === model.id) {
        setStatusText(`Optimizing ${model.id} context window...`);
        try { await window.electronAPI.unloadModel(model.id); } catch { /* non-fatal */ }
        const reloadOpts: Record<string, any> = { ctx_size: 16384 };
        if (model.recipe === 'llamacpp') reloadOpts.llamacpp_backend = 'vulkan';
        const reload = await window.electronAPI.loadModel(model.id, reloadOpts);
        if (reload === false || (reload && !reload.success)) {
          console.warn('Reload with ctx_size failed, continuing with existing config:', reload);
        }
      } else {
        if (loadedLLM) {
          setStatusText(`Unloading ${loadedLLM.model_name}...`);
          try { await window.electronAPI.unloadModel(loadedLLM.model_name); } catch { /* non-fatal */ }
        }
        setStatusText(`Loading ${model.id}...`);
        const opts: Record<string, any> = { ctx_size: 16384 };
        if (model.recipe === 'llamacpp') opts.llamacpp_backend = 'vulkan';
        const load = await window.electronAPI.loadModel(model.id, opts);
        if (load === false || (load && !load.success)) {
          setPhase('error');
          setErrorText(`Load failed: ${load && load.message ? load.message : 'Unknown error'}`);
          return;
        }
      }

      let bestASR: CompatibleModel | null = null;
      let ttsReady = false;
      let asrReady = false;
      setStatusText('Preparing voice features...');

      let allModels: CompatibleModel[] = [];
      try { allModels = await window.electronAPI.listAllModels(); } catch { /* noop */ }

      const asrs = allModels.filter(m => m.labels.includes('audio') && !m.id.toLowerCase().includes('kokoro'));
      bestASR = asrs.find(m => m.suggested && m.downloaded) || asrs.find(m => m.suggested) || asrs.find(m => m.downloaded) || asrs[0] || null;

      if (bestASR) {
        if (!bestASR.downloaded) {
          setStatusText(`Downloading ${bestASR.id} for speech recognition...`);
          window.electronAPI.onPullProgress((data: DownloadProgress) => setDlProgress(data));
          const asrPull = await window.electronAPI.pullModelStreaming(bestASR.id);
          window.electronAPI.offPullProgress();
          if (asrPull === false || (asrPull && !asrPull.success)) {
            console.warn('ASR model download failed:', asrPull);
          } else {
            bestASR.downloaded = true;
          }
        }

        if (bestASR.downloaded) {
          if (loadedASR && loadedASR.model_name === bestASR.id) {
            asrReady = true;
          } else {
            if (loadedASR) {
              try { await window.electronAPI.unloadModel(loadedASR.model_name); } catch { /* non-fatal */ }
            }
            setStatusText(`Loading ${bestASR.id}...`);
            const asrLoad = await window.electronAPI.loadModel(bestASR.id);
            if (asrLoad === false || (asrLoad && !asrLoad.success)) {
              const msg = asrLoad && asrLoad.message ? asrLoad.message : 'Unknown error';
              console.warn(`ASR model load failed: ${msg}`);
            } else {
              asrReady = true;
            }
          }
        }
      }

      const ttsModelId = 'kokoro-v1';
      const loadedTTS = loadedModels.find(m => m.model_name.toLowerCase().includes('kokoro'));

      if (loadedTTS) {
        ttsReady = true;
      } else {
        const kokoroModel = allModels.find(m => m.id.toLowerCase().includes('kokoro'));
        if (kokoroModel && !kokoroModel.downloaded) {
          setStatusText(`Downloading ${kokoroModel.id} for text-to-speech...`);
          window.electronAPI.onPullProgress((data: DownloadProgress) => setDlProgress(data));
          const ttsPull = await window.electronAPI.pullModelStreaming(kokoroModel.id);
          window.electronAPI.offPullProgress();
          if (ttsPull && ttsPull.success) kokoroModel.downloaded = true;
        }
        const ttsId = kokoroModel?.id || ttsModelId;
        setStatusText(`Loading ${ttsId} for speech...`);
        try {
          const ttsLoad = await window.electronAPI.loadModel(ttsId);
          if (ttsLoad && ttsLoad.success) ttsReady = true;
        } catch { /* non-fatal */ }
      }

      await window.electronAPI.updateInterviewerSettings({
        modelName: model.id,
        asrModel: bestASR?.id,
        interviewStyle,
        questionDifficulty,
      });

      setPhase('generating-persona');
      setPersonaGenStep('analyzing-job');
      setStatusText('Analyzing job description...');

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
            interviewType: state.interviewMode === 'single' ? state.formData.interviewType : 'behavioral',
            company: state.formData.company,
            position: state.formData.position,
          });
          setGeneratedPersona(result.persona);
          setJobAnalysis(result.jobAnalysis);
          setResumeAnalysis(result.resumeAnalysis);
          personaId = result.persona.id;
        } catch { /* non-fatal */ }
      }

      setPersonaGenStep('done');
      setStatusText('Starting interview...');
      const interview = await window.electronAPI.startInterview(
        {
          title: state.formData.title,
          company: state.formData.company,
          position: state.formData.position,
          interviewType: state.interviewMode === 'single' ? state.formData.interviewType : ('behavioral' as InterviewType),
        },
        personaId,
      );
      if (!interview) { setPhase('error'); setErrorText('Failed to create interview.'); return; }

      setStatusText('Ready!');
      await new Promise(r => setTimeout(r, 350));
      navigate(`/interview/${interview.id}`, { replace: true, state: { voiceEnabled: asrReady && ttsReady } });
    } catch (e: any) {
      setPhase('error');
      setErrorText(e.message || 'An unexpected error occurred.');
    }
  }, [state, selectedModelId, llmModels, navigate, interviewStyle, questionDifficulty]);

  if (!state) return null;

  const selectedModel = llmModels.find(m => m.id === selectedModelId) || null;
  const isWorking = phase === 'downloading' || phase === 'loading-model' || phase === 'generating-persona';

  return (
    <div className="h-screen w-full bg-lemonade-bg dark:bg-lemonade-dark-bg text-black dark:text-white flex flex-col overflow-hidden transition-colors duration-300">

      {/* ═══════ TOP BAR ═══════ */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200/50 dark:border-white/5 bg-lemonade-bg dark:bg-lemonade-dark-surface transition-colors duration-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors text-gray-400 hover:text-black dark:hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Prepare for your interview</h1>
            <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5">
              {state.formData.title} &middot; {state.formData.company} &middot; {state.formData.position}
            </p>
          </div>
        </div>
        {selectedModel && isWorking && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/5 rounded-xl text-gray-600 dark:text-white/60">
            <Cpu size={12} className="text-lemonade-accent-hover" />
            <span className="text-[11px] font-semibold">{selectedModel.id}</span>
          </span>
        )}
      </header>

      {/* ═══════ MAIN ═══════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Resume viewer ─── */}
        <div className="flex-1 flex items-center justify-center p-8 bg-lemonade-bg dark:bg-lemonade-dark-bg transition-colors duration-300">
          {pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full rounded-2xl border border-gray-200/50 dark:border-white/5 bg-white dark:bg-lemonade-dark-surface"
              title="Resume Preview"
            />
          ) : resumeText ? (
            <div className="w-full max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-3 text-gray-500 dark:text-white/40">
                <FileText size={14} />
                <span className="text-xs font-medium">{state.resumeFileName}</span>
              </div>
              <div className="max-h-[75vh] overflow-y-auto bg-lemonade-bg dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/5 rounded-2xl p-6">
                <p className="text-sm whitespace-pre-wrap leading-relaxed dark:text-white/80">{resumeText}</p>
              </div>
            </div>
          ) : (
            <div className="text-center select-none">
              <FileText size={48} className="mx-auto mb-4 text-gray-300 dark:text-white/15" />
              <p className="text-sm font-medium text-gray-500 dark:text-white/40">{state.resumeFileName || 'Your resume'}</p>
              <p className="text-xs text-gray-400 dark:text-white/30 mt-1">Review while we get things ready</p>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Panel ─── */}
        <aside className="w-[400px] border-l border-gray-200/50 dark:border-white/5 bg-lemonade-bg dark:bg-lemonade-dark-surface flex flex-col transition-colors duration-300">

          {/* ── loading list ── */}
          {phase === 'loading-list' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
              <div className="w-12 h-12 rounded-2xl bg-lemonade-accent/10 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-lemonade-accent-hover" />
              </div>
              <p className="text-sm text-gray-500 dark:text-white/40 font-medium">{statusText}</p>
            </div>
          )}

          {/* ═══════ SELECT PHASE ═══════ */}
          {phase === 'select' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <div className="px-5 pt-5 pb-4 space-y-5">
                  {/* Interview preferences */}
                  <div className="space-y-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
                      Interview Preferences
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500 dark:text-white/40">Style</label>
                        <LemonSelect
                          value={interviewStyle}
                          onChange={(v) => setInterviewStyle(v as InterviewStyle)}
                          className="h-9 text-xs"
                          options={[
                            { value: 'conversational', label: 'Conversational' },
                            { value: 'formal', label: 'Formal' },
                            { value: 'challenging', label: 'Challenging' },
                            { value: 'supportive', label: 'Supportive' },
                          ]}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-500 dark:text-white/40">Difficulty</label>
                        <LemonSelect
                          value={questionDifficulty}
                          onChange={(v) => setQuestionDifficulty(v as 'easy' | 'medium' | 'hard')}
                          className="h-9 text-xs"
                          options={[
                            { value: 'easy', label: 'Easy' },
                            { value: 'medium', label: 'Medium' },
                            { value: 'hard', label: 'Hard' },
                          ]}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100/60 dark:border-white/[0.04]" />

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">
                      Choose a model
                    </h2>
                    <p className="text-[11px] text-gray-500 dark:text-white/40 leading-relaxed">
                      Pick the AI model for your interview.
                      Models marked <span className="text-green-600 dark:text-green-400 font-medium">ready</span> are
                      already downloaded.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {llmModels.map(model => {
                      const selected = model.id === selectedModelId;
                      return (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModelId(model.id)}
                          className={`group w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                            selected
                              ? 'border-lemonade-accent bg-lemonade-accent/[0.06]'
                              : 'border-gray-200/50 dark:border-white/5 bg-lemonade-bg dark:bg-white/[0.03] hover:border-gray-300 dark:hover:border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className={`shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              selected ? 'border-lemonade-accent' : 'border-gray-300 dark:border-white/20'
                            }`}>
                              {selected && <div className="w-2 h-2 rounded-full bg-lemonade-accent" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate leading-tight">{model.id}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {model.suggested && (
                                  <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-px bg-lemonade-accent/15 text-lemonade-accent-hover rounded-full font-medium">
                                    <Star size={9} className="fill-lemonade-accent text-lemonade-accent" />
                                    Suggested
                                  </span>
                                )}
                                {model.labels.filter(l => l !== 'llm').map(l => (
                                  <span key={l} className="text-[11px] px-1.5 py-px border border-gray-200/50 dark:border-white/5 rounded-full text-gray-500 dark:text-white/40">{l}</span>
                                ))}
                              </div>
                            </div>

                            <div className="shrink-0 flex flex-col items-end gap-1">
                              {model.size ? (
                                <span className="text-[11px] font-medium text-gray-400 dark:text-white/30">{formatSize(model.size)}</span>
                              ) : null}
                              {model.downloaded ? (
                                <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-px bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400 rounded-full font-medium">
                                  <HardDrive size={9} /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-px border border-gray-200/50 dark:border-white/5 text-gray-500 dark:text-white/40 rounded-full">
                                  <Download size={9} /> Download
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* action bar */}
              <div className="px-5 py-4 border-t border-gray-100/60 dark:border-white/[0.04]">
                <button
                  onClick={handleContinue}
                  disabled={!selectedModelId}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-lemonade-accent text-black font-semibold text-sm rounded-xl hover:bg-lemonade-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {selectedModel && !selectedModel.downloaded ? (
                    <>
                      <Download size={14} />
                      Download &amp; Start Interview
                    </>
                  ) : (
                    <>
                      <ArrowRight size={14} />
                      Start Interview
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ═══════ DOWNLOADING PHASE ═══════ */}
          {phase === 'downloading' && (
            <div className="flex-1 flex flex-col px-6 pt-8">
              <div className="w-12 h-12 rounded-2xl bg-lemonade-accent/10 flex items-center justify-center mb-5">
                <Download size={22} className="text-lemonade-accent-hover animate-bounce" />
              </div>

              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 mb-1">Downloading</h2>
              <p className="text-sm font-semibold text-gray-600 dark:text-white/50 mb-5">{selectedModel?.id}</p>

              <div className="w-full h-2.5 bg-gray-200/60 dark:bg-white/10 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-gradient-to-r from-lemonade-accent to-lemonade-accent-hover rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${dlProgress?.percent ?? 0}%` }}
                />
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-500 dark:text-white/40">
                  {dlProgress?.bytesDownloaded != null && dlProgress?.bytesTotal != null
                    ? `${formatBytes(dlProgress.bytesDownloaded)} / ${formatBytes(dlProgress.bytesTotal)}`
                    : 'Preparing...'}
                </span>
                <span className="text-base font-bold tabular-nums">
                  {dlProgress?.percent ?? 0}<span className="text-xs font-medium text-gray-400 dark:text-white/30">%</span>
                </span>
              </div>

              {dlProgress?.file && (
                <p className="text-[11px] text-gray-400 dark:text-white/30 truncate mt-2">
                  {dlProgress.file}
                  {dlProgress.totalFiles && dlProgress.totalFiles > 1
                    ? ` (file ${dlProgress.fileIndex} of ${dlProgress.totalFiles})`
                    : ''}
                </p>
              )}

              <p className="text-[11px] text-gray-400 dark:text-white/30 mt-auto pb-6">
                Review your resume while the model downloads.
              </p>
            </div>
          )}

          {/* ═══════ LOADING MODEL PHASE ═══════ */}
          {phase === 'loading-model' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-lemonade-accent/10 flex items-center justify-center">
                  <Zap size={24} className="text-lemonade-accent-hover" />
                </div>
                <div className="absolute -inset-2 rounded-[18px] border-2 border-lemonade-accent/15 border-t-lemonade-accent animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">{statusText}</p>
                <p className="text-[11px] text-gray-500 dark:text-white/40 mt-1.5">
                  Warming up the model — this can take a moment
                </p>
              </div>
            </div>
          )}

          {/* ═══════ GENERATING PERSONA PHASE ═══════ */}
          {phase === 'generating-persona' && (
            <div className="flex-1 flex flex-col px-6 pt-8">
              <div className="w-12 h-12 rounded-2xl bg-lemonade-accent/10 flex items-center justify-center mb-5">
                <Sparkles size={22} className="text-lemonade-accent-hover" />
              </div>

              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 mb-1">
                Preparing Your Interview
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-white/40 mb-6 leading-relaxed">
                The AI is reading your documents and crafting a personalized interviewer.
              </p>

              <div className="space-y-4">
                <PersonaStep
                  isActive={personaGenStep === 'analyzing-job'}
                  isDone={personaGenStep !== 'analyzing-job'}
                  icon={<FileText size={13} />}
                  title="Reading job description"
                  subtitle="Understanding role requirements and expectations"
                  analysis={jobAnalysis && personaGenStep !== 'analyzing-job' ? jobAnalysis : null}
                />
                <PersonaStep
                  isActive={personaGenStep === 'analyzing-resume'}
                  isDone={personaGenStep === 'crafting-persona' || personaGenStep === 'done'}
                  isPending={personaGenStep === 'analyzing-job'}
                  icon={<User size={13} />}
                  title="Analyzing your resume"
                  subtitle="Mapping your experience to the role"
                  analysis={(personaGenStep === 'crafting-persona' || personaGenStep === 'done') ? resumeAnalysis : null}
                />
                <PersonaStep
                  isActive={personaGenStep === 'crafting-persona'}
                  isDone={personaGenStep === 'done'}
                  isPending={personaGenStep === 'analyzing-job' || personaGenStep === 'analyzing-resume'}
                  icon={<Bot size={13} />}
                  title="Crafting interviewer persona"
                  subtitle="Building a tailored interviewer for this role"
                  persona={personaGenStep === 'done' ? generatedPersona : null}
                />

                {personaGenStep === 'done' && (
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-lemonade-accent/15 flex items-center justify-center">
                      <Loader2 size={13} className="animate-spin text-lemonade-accent-hover" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-xs font-semibold">Starting interview...</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5">Almost there</p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-400 dark:text-white/30 mt-auto pb-6">
                This ensures your interview is tailored to the exact role and your background.
              </p>
            </div>
          )}

          {/* ═══════ ERROR PHASE ═══════ */}
          {phase === 'error' && (
            <div className="flex-1 flex flex-col justify-center px-6">
              <div className="border border-red-200/60 dark:border-red-500/15 bg-red-50 dark:bg-red-500/10 rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle size={14} className="text-red-500 dark:text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1">Something went wrong</p>
                    <p className="text-xs text-red-500/80 dark:text-red-400/60 whitespace-pre-wrap leading-relaxed">{errorText}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4 ml-10">
                  <button
                    onClick={() => { setErrorText(null); setPhase('select'); }}
                    className="px-4 py-2 text-xs font-semibold border border-gray-200/60 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors"
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

/* ── Persona generation step sub-component ── */
const PersonaStep: React.FC<{
  isActive: boolean;
  isDone: boolean;
  isPending?: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  analysis?: string | null;
  persona?: AgentPersona | null;
}> = ({ isActive, isDone, isPending, icon, title, subtitle, analysis, persona }) => (
  <div className="flex items-start gap-3">
    <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
      isActive ? 'bg-lemonade-accent/15' : isDone ? 'bg-green-100 dark:bg-green-500/15' : 'bg-gray-100 dark:bg-white/[0.04]'
    }`}>
      {isActive ? <Loader2 size={13} className="animate-spin text-lemonade-accent-hover" /> : isDone ? <Check size={13} className="text-green-500" /> : <span className="text-gray-300 dark:text-white/15">{icon}</span>}
    </div>
    <div className="pt-0.5">
      <p className={`text-xs font-semibold transition-colors ${
        isActive ? '' : isDone ? 'text-green-600 dark:text-green-400' : isPending ? 'text-gray-300 dark:text-white/20' : ''
      }`}>
        {title}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5">{subtitle}</p>
      {analysis && (
        <p className="text-[11px] text-gray-500 dark:text-white/35 mt-1.5 bg-gray-50 dark:bg-white/[0.03] rounded-lg p-2 leading-relaxed">
          {analysis}
        </p>
      )}
      {persona && (
        <div className="mt-2 border border-lemonade-accent/15 bg-lemonade-accent/[0.04] rounded-xl p-3">
          <p className="text-xs font-semibold">{persona.name}</p>
          <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5 leading-relaxed">{persona.description}</p>
          <div className="flex gap-1.5 mt-2">
            <span className="text-[11px] px-1.5 py-px bg-lemonade-accent/15 text-lemonade-accent-hover rounded-full font-medium">{persona.interviewStyle}</span>
            <span className="text-[11px] px-1.5 py-px bg-lemonade-accent/15 text-lemonade-accent-hover rounded-full font-medium">{persona.questionDifficulty}</span>
          </div>
        </div>
      )}
    </div>
  </div>
);

export default Preparing;
