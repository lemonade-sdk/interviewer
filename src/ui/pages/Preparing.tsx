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
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Separator } from '../components/ui/separator';
import { cn } from '../lib/utils';

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

  /* ── interview style & difficulty selectors ── */
  const [interviewStyle, setInterviewStyle] = useState<InterviewStyle>('conversational');
  const [questionDifficulty, setQuestionDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

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
        // Check if the server supports audio models:
        // 1. max_models.audio explicitly set to > 0, OR
        // 2. Audio models are already loaded (server allows audio even if
        //    max_models doesn't include the "audio" key — default is 1).
        const maxModels = health?.max_models;
        const hasAudioSlot = maxModels?.audio != null ? maxModels.audio > 0 : true; // default audio=1
        const hasLoadedAudio = loadedModels.some(m => m.type === 'audio');
        serverSupportsAudio = hasAudioSlot || hasLoadedAudio;
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
        // The correct LLM is already loaded, but the context window may be
        // too small (server default is 4096).  We need ctx_size >= 16384 for
        // persona generation.  Force a reload with the desired ctx_size
        // because the /health endpoint doesn't expose the current n_ctx.
        console.log(`LLM ${model.id} is already loaded — reloading with ctx_size=16384`);
        setStatusText(`Optimizing ${model.id} context window...`);
        try {
          await window.electronAPI.unloadModel(model.id);
        } catch (e) {
          console.warn('Unload before ctx_size reload failed (non-fatal):', e);
        }
        const reloadOpts: Record<string, any> = { ctx_size: 16384 };
        if (model.recipe === 'llamacpp') {
          reloadOpts.llamacpp_backend = 'vulkan';
        }
        const reload = await window.electronAPI.loadModel(model.id, reloadOpts);
        if (reload === false || (reload && !reload.success)) {
          console.warn('Reload with ctx_size failed, continuing with existing config:', reload);
        }
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

      /* ════════════════════════════════════════════════════════════
         AUDIO MODELS: ASR (Whisper) + TTS (Kokoro)
         Always attempt to load audio models regardless of the
         max_models.audio value — the server may support audio even
         if the health endpoint doesn't report the slot. If loading
         truly fails we degrade gracefully (text-only interview).
         ════════════════════════════════════════════════════════════ */
      let bestASR: CompatibleModel | null = null;
      let ttsReady = false;
      let asrReady = false;

      setStatusText('Preparing voice features...');

      // Fetch the full model catalog to find audio models
      let allModels: CompatibleModel[] = [];
      try {
        allModels = await window.electronAPI.listAllModels();
      } catch {
        console.warn('Could not list models for audio setup');
      }

      /* ── ASR (Whisper) — speech-to-text ── */
      const asrs = allModels.filter(m => m.labels.includes('audio') && !m.id.toLowerCase().includes('kokoro'));
      bestASR =
        asrs.find(m => m.suggested && m.downloaded) ||
        asrs.find(m => m.suggested) ||
        asrs.find(m => m.downloaded) ||
        asrs[0] || null;

      if (bestASR) {
        // Download ASR model if needed
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

        // Load ASR model (smart: skip if already active)
        if (bestASR.downloaded) {
          if (loadedASR && loadedASR.model_name === bestASR.id) {
            console.log(`ASR model ${bestASR.id} is already loaded`);
            asrReady = true;
          } else {
            if (loadedASR) {
              try { await window.electronAPI.unloadModel(loadedASR.model_name); } catch { /* non-fatal: unload may fail */ }
            }
            setStatusText(`Loading ${bestASR.id}...`);
            const asrLoad = await window.electronAPI.loadModel(bestASR.id);
            if (asrLoad === false || (asrLoad && !asrLoad.success)) {
              const msg = asrLoad && asrLoad.message ? asrLoad.message : 'Unknown error';
              console.warn(`ASR model load failed: ${msg}`);
              if (msg.includes('max_models') || msg.includes('audio') || !serverSupportsAudio) {
                console.error(
                  '╔══════════════════════════════════════════════════════════╗\n' +
                  '║  AUDIO MODELS UNAVAILABLE                               ║\n' +
                  '║  Your Lemonade Server has no audio model slot.           ║\n' +
                  '║  Restart the server with:                                ║\n' +
                  '║    lemonade-server --max-loaded-models 1 1 1 2           ║\n' +
                  '║  (LLMs, Embeddings, Reranking, Audio)                    ║\n' +
                  '║  This enables both Whisper (ASR) and Kokoro (TTS).       ║\n' +
                  '╚══════════════════════════════════════════════════════════╝'
                );
              }
            } else {
              console.log(`ASR model ${bestASR.id} loaded successfully`);
              asrReady = true;
            }
          }
        }
      } else {
        console.warn('No ASR (Whisper) model found in model catalog');
      }

      /* ── TTS (Kokoro) — text-to-speech ── */
      // kokoro-v1 is the TTS model that powers /api/v1/audio/speech.
      // It may appear in the model list, or it may need to be loaded by name.
      const ttsModelId = 'kokoro-v1';
      const loadedTTS = loadedModels.find(
        m => m.model_name.toLowerCase().includes('kokoro')
      );

      if (loadedTTS) {
        console.log(`TTS model ${loadedTTS.model_name} is already loaded`);
        ttsReady = true;
      } else {
        // Try to find kokoro in the catalog
        const kokoroModel = allModels.find(m => m.id.toLowerCase().includes('kokoro'));

        if (kokoroModel && !kokoroModel.downloaded) {
          setStatusText(`Downloading ${kokoroModel.id} for text-to-speech...`);
          window.electronAPI.onPullProgress((data: DownloadProgress) => setDlProgress(data));
          const ttsPull = await window.electronAPI.pullModelStreaming(kokoroModel.id);
          window.electronAPI.offPullProgress();
          if (ttsPull && ttsPull.success) kokoroModel.downloaded = true;
        }

        // Attempt to load the TTS model
        const ttsId = kokoroModel?.id || ttsModelId;
        setStatusText(`Loading ${ttsId} for speech...`);
        try {
          const ttsLoad = await window.electronAPI.loadModel(ttsId);
          if (ttsLoad && ttsLoad.success) {
            console.log(`TTS model ${ttsId} loaded successfully`);
            ttsReady = true;
          } else {
            console.warn(`TTS model load failed: ${ttsLoad && typeof ttsLoad !== 'boolean' ? ttsLoad.message : 'Unknown error'}`);
          }
        } catch (ttsErr: any) {
          console.warn('TTS model load error:', ttsErr.message || ttsErr);
        }
      }

      // Log final audio readiness
      console.log(`Voice features: ASR=${asrReady ? 'ready' : 'unavailable'}, TTS=${ttsReady ? 'ready' : 'unavailable'}`);
      if (!asrReady && !ttsReady && !serverSupportsAudio) {
        console.error(
          'Voice features disabled. To enable, restart Lemonade Server with:\n' +
          '  lemonade-server --max-loaded-models 1 1 1 2'
        );
      }

      await window.electronAPI.updateInterviewerSettings({
        modelName: model.id,
        asrModel: bestASR?.id,
        interviewStyle,
        questionDifficulty,
      });

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
      navigate(`/interview/${interview.id}`, {
        replace: true,
        state: { voiceEnabled: asrReady && ttsReady },
      });
    } catch (e: any) {
      console.error('Preparation failed:', e);
      setPhase('error');
      setErrorText(e.message || 'An unexpected error occurred.');
    }
  }, [state, selectedModelId, llmModels, navigate]);

  /* ────────────────── guard ──────────────── */
  if (!state) return null;

  const selectedModel = llmModels.find(m => m.id === selectedModelId) || null;
  const isWorking = phase === 'downloading' || phase === 'loading-model' || phase === 'generating-persona';

  /* ══════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════ */
  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col overflow-hidden">

      {/* ═══════ TOP BAR ═══════ */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate('/')}
          >
            <ChevronLeft size={18} />
          </Button>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Prepare for your interview
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5 tracking-wide">
              {state.formData.title} &middot; {state.formData.company} &middot; {state.formData.position}
            </p>
          </div>
        </div>

        {selectedModel && isWorking && (
          <Badge variant="secondary" className="gap-1.5">
            <Cpu size={12} />
            <span className="text-[11px] font-semibold">{selectedModel.id}</span>
          </Badge>
        )}
      </header>

      {/* ═══════ MAIN ═══════ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ─── LEFT: Resume viewer ─── */}
        <div className="flex-1 flex items-center justify-center p-8 bg-muted/30">
          {pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full rounded-xl border border-border shadow-lg bg-card"
              title="Resume Preview"
            />
          ) : resumeText ? (
            <div className="w-full max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                <FileText size={16} />
                <span className="text-xs font-medium">{state.resumeFileName}</span>
              </div>
              <Card className="max-h-[75vh] overflow-y-auto">
                <CardContent className="p-6">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{resumeText}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center select-none">
              <FileText size={56} className="mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">{state.resumeFileName || 'Your resume'}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Review while we get things ready</p>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Panel ─── */}
        <aside className="w-[420px] border-l border-border bg-card flex flex-col">

          {/* ── loading list ── */}
          {phase === 'loading-list' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin text-primary" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">{statusText}</p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              SELECT PHASE — the model catalogue
             ══════════════════════════════════════════════ */}
          {phase === 'select' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="px-6 pt-6 pb-4 space-y-6">
                  {/* Interview preferences */}
                  <div className="space-y-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Interview Preferences
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Style</Label>
                        <Select value={interviewStyle} onValueChange={(v) => setInterviewStyle(v as InterviewStyle)}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conversational">Conversational</SelectItem>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="challenging">Challenging</SelectItem>
                            <SelectItem value="supportive">Supportive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Difficulty</Label>
                        <Select value={questionDifficulty} onValueChange={(v) => setQuestionDifficulty(v as 'easy' | 'medium' | 'hard')}>
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Model Selection */}
                  <div className="space-y-3">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      Choose a model
                    </h2>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Pick the AI model that will power your interview.
                      Models marked <span className="text-green-500 dark:text-green-400 font-semibold">ready</span> are
                      already on your machine.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {llmModels.map(model => {
                      const selected = model.id === selectedModelId;
                      return (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModelId(model.id)}
                          className={cn(
                            'group w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-200',
                            selected
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className={cn(
                              'flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all duration-200 flex items-center justify-center',
                              selected ? 'border-primary' : 'border-muted-foreground/30 group-hover:border-muted-foreground/50'
                            )}>
                              {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold truncate leading-tight">{model.id}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {model.suggested && (
                                  <Badge variant="secondary" className="text-[9px] h-4 gap-0.5 px-1.5">
                                    <Star size={8} className="fill-primary text-primary" />
                                    Suggested
                                  </Badge>
                                )}
                                {model.labels.filter(l => l !== 'llm').map(l => (
                                  <Badge key={l} variant="outline" className="text-[9px] h-4 px-1.5">{l}</Badge>
                                ))}
                              </div>
                            </div>

                            <div className="flex-shrink-0 flex flex-col items-end gap-1">
                              {model.size ? (
                                <span className="text-[10px] font-semibold text-muted-foreground">{formatSize(model.size)}</span>
                              ) : null}
                              {model.downloaded ? (
                                <Badge className="text-[9px] h-4 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 gap-0.5">
                                  <HardDrive size={8} /> Ready
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[9px] h-4 gap-0.5">
                                  <Download size={8} /> Download
                                </Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>

              {/* action bar */}
              <div className="px-5 py-4 border-t border-border">
                <Button
                  onClick={handleContinue}
                  disabled={!selectedModelId}
                  className="w-full gap-2"
                  size="lg"
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
                </Button>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              DOWNLOADING PHASE
             ══════════════════════════════════════════════ */}
          {phase === 'downloading' && (
            <div className="flex-1 flex flex-col px-8 pt-10">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Download size={24} className="text-primary animate-bounce" />
              </div>

              <h2 className="text-sm font-bold uppercase tracking-widest mb-1">Downloading</h2>
              <p className="text-[13px] font-semibold text-muted-foreground mb-5">{selectedModel?.id}</p>

              <Progress value={dlProgress?.percent ?? 0} className="h-3 mb-3" />

              <div className="flex items-baseline justify-between">
                <span className="text-xs text-muted-foreground">
                  {dlProgress?.bytesDownloaded != null && dlProgress?.bytesTotal != null
                    ? `${formatBytes(dlProgress.bytesDownloaded)} / ${formatBytes(dlProgress.bytesTotal)}`
                    : 'Preparing...'}
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {dlProgress?.percent ?? 0}<span className="text-xs font-semibold text-muted-foreground">%</span>
                </span>
              </div>

              {dlProgress?.file && (
                <p className="text-[10px] text-muted-foreground/60 truncate mt-2">
                  {dlProgress.file}
                  {dlProgress.totalFiles && dlProgress.totalFiles > 1
                    ? ` (file ${dlProgress.fileIndex} of ${dlProgress.totalFiles})`
                    : ''}
                </p>
              )}

              <p className="text-[11px] text-muted-foreground/50 mt-auto pb-6">
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
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Zap size={28} className="text-primary" />
                </div>
                <div className="absolute -inset-2 rounded-[18px] border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">{statusText}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5">
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
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles size={24} className="text-primary" />
              </div>

              <h2 className="text-sm font-bold uppercase tracking-widest mb-1">
                Preparing Your Interview
              </h2>
              <p className="text-[11px] text-muted-foreground mb-6 leading-relaxed">
                The AI is reading your documents and crafting a personalized interviewer.
              </p>

              {/* Step indicators */}
              <div className="space-y-4">
                {/* Step 1: Analyzing Job */}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500',
                    personaGenStep === 'analyzing-job'
                      ? 'bg-primary/15'
                      : 'bg-green-100 dark:bg-green-950/50'
                  )}>
                    {personaGenStep === 'analyzing-job' ? (
                      <Loader2 size={14} className="animate-spin text-primary" />
                    ) : (
                      <Check size={14} className="text-green-500" />
                    )}
                  </div>
                  <div className="pt-1">
                    <p className={cn('text-[13px] font-semibold transition-colors duration-300',
                      personaGenStep === 'analyzing-job' ? 'text-foreground' : 'text-green-600 dark:text-green-400'
                    )}>
                      Reading job description
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Understanding role requirements, skills, and expectations
                    </p>
                    {jobAnalysis && personaGenStep !== 'analyzing-job' && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 bg-muted rounded-lg p-2 leading-relaxed">
                        {jobAnalysis}
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 2: Analyzing Resume */}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500',
                    personaGenStep === 'analyzing-resume'
                      ? 'bg-primary/15'
                      : personaGenStep === 'analyzing-job'
                        ? 'bg-muted'
                        : 'bg-green-100 dark:bg-green-950/50'
                  )}>
                    {personaGenStep === 'analyzing-resume' ? (
                      <Loader2 size={14} className="animate-spin text-primary" />
                    ) : personaGenStep === 'analyzing-job' ? (
                      <User size={14} className="text-muted-foreground/40" />
                    ) : (
                      <Check size={14} className="text-green-500" />
                    )}
                  </div>
                  <div className="pt-1">
                    <p className={cn('text-[13px] font-semibold transition-colors duration-300',
                      personaGenStep === 'analyzing-resume'
                        ? 'text-foreground'
                        : personaGenStep === 'analyzing-job'
                          ? 'text-muted-foreground/40'
                          : 'text-green-600 dark:text-green-400'
                    )}>
                      Analyzing your resume
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Mapping your experience to the role requirements
                    </p>
                    {resumeAnalysis && (personaGenStep === 'crafting-persona' || personaGenStep === 'done') && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 bg-muted rounded-lg p-2 leading-relaxed">
                        {resumeAnalysis}
                      </p>
                    )}
                  </div>
                </div>

                {/* Step 3: Crafting Persona */}
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-500',
                    personaGenStep === 'crafting-persona'
                      ? 'bg-primary/15'
                      : personaGenStep === 'done'
                        ? 'bg-green-100 dark:bg-green-950/50'
                        : 'bg-muted'
                  )}>
                    {personaGenStep === 'crafting-persona' ? (
                      <Loader2 size={14} className="animate-spin text-primary" />
                    ) : personaGenStep === 'done' ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <Bot size={14} className="text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="pt-1">
                    <p className={cn('text-[13px] font-semibold transition-colors duration-300',
                      personaGenStep === 'crafting-persona'
                        ? 'text-foreground'
                        : personaGenStep === 'done'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-muted-foreground/40'
                    )}>
                      Crafting interviewer persona
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Building a tailored interviewer for this specific role
                    </p>
                    {generatedPersona && personaGenStep === 'done' && (
                      <Card className="mt-2 border-primary/20 bg-primary/5">
                        <CardContent className="p-3">
                          <p className="text-[12px] font-bold">{generatedPersona.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{generatedPersona.description}</p>
                          <div className="flex gap-1.5 mt-2">
                            <Badge variant="secondary" className="text-[9px] h-4">{generatedPersona.interviewStyle}</Badge>
                            <Badge variant="secondary" className="text-[9px] h-4">{generatedPersona.questionDifficulty}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

                {/* Step 4: Starting (merged from the old separate 'starting' phase) */}
                {personaGenStep === 'done' && (
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Loader2 size={14} className="animate-spin text-primary" />
                    </div>
                    <div className="pt-1">
                      <p className="text-[13px] font-semibold text-foreground">Starting interview...</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">You're almost there</p>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground/50 mt-auto pb-6">
                This ensures your interview is tailored to the exact role and your background.
              </p>
            </div>
          )}

          {/* ══════════════════════════════════════════════
              ERROR PHASE
             ══════════════════════════════════════════════ */}
          {phase === 'error' && (
            <div className="flex-1 flex flex-col justify-center px-7">
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <AlertCircle size={16} className="text-destructive" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-destructive mb-1">Something went wrong</p>
                      <p className="text-xs text-destructive/80 whitespace-pre-wrap leading-relaxed">{errorText}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4 ml-11">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setErrorText(null); setPhase('select'); }}
                    >
                      Try again
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/')}
                    >
                      Go back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Preparing;
