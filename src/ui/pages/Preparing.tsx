import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, FileText, Check, Download, Loader2, ChevronLeft } from 'lucide-react';
import { InterviewType, CompatibleModel, UploadedDocument } from '../../types';

// ── Route state passed from Landing ──
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
  resumeBase64: string | null; // kept in memory from upload
}

// ── Pick best LLM and ASR from the compatible model list ──
function pickModels(models: CompatibleModel[]) {
  const llmCandidates = models.filter(
    m =>
      !m.labels.includes('audio') &&
      !m.labels.includes('embedding') &&
      !m.labels.includes('reranking') &&
      !m.labels.includes('image'),
  );

  const pickBest = (candidates: CompatibleModel[]) => {
    return (
      candidates.find(m => m.suggested && m.downloaded) ||
      candidates.find(m => m.suggested) ||
      candidates.find(m => m.downloaded) ||
      candidates[0] ||
      null
    );
  };

  const llm = pickBest(llmCandidates);
  const asrCandidates = models.filter(m => m.labels.includes('audio'));
  const asr = pickBest(asrCandidates);

  return { llm, asr };
}

const Preparing: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as PreparingState | undefined;

  // ── Preparation state ──
  const [selectedLLM, setSelectedLLM] = useState<CompatibleModel | null>(null);
  const [selectedASR, setSelectedASR] = useState<CompatibleModel | null>(null);
  const [prepStatus, setPrepStatus] = useState('Checking compatible models...');
  const [prepProgress, setPrepProgress] = useState(0);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [resumeText, setResumeText] = useState<string | null>(null);

  // ── Guard: if no state was passed, go back to landing ──
  useEffect(() => {
    if (!state) {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  // ── Clean up blob URL on unmount ──
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    };
  }, [pdfBlobUrl]);

  // ── Build PDF preview from base64 data ──
  const buildPdfPreview = useCallback(async () => {
    // Try in-memory base64 first (fastest)
    if (state?.resumeBase64) {
      try {
        const byteChars = atob(state.resumeBase64);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        setPdfBlobUrl(URL.createObjectURL(blob));
        return;
      } catch {
        console.warn('Could not create PDF blob URL from in-memory data');
      }
    }

    // Fallback: fetch from main process by document id
    if (state?.resumeDocId && window.electronAPI) {
      try {
        const data = await window.electronAPI.getDocumentFileData(state.resumeDocId);
        if (data && data.mimeType === 'application/pdf') {
          const byteChars = atob(data.base64);
          const byteArray = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteArray[i] = byteChars.charCodeAt(i);
          }
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          setPdfBlobUrl(URL.createObjectURL(blob));
        }
      } catch {
        console.warn('Could not fetch resume file data from main process');
      }
    }
  }, [state]);

  // ── Fetch extracted text for non-PDF fallback display ──
  const loadResumeText = useCallback(async () => {
    if (!state?.resumeDocId || !window.electronAPI) return;
    try {
      const doc: UploadedDocument | null = await window.electronAPI.getDocument(state.resumeDocId);
      if (doc?.extractedText) {
        setResumeText(doc.extractedText);
      }
    } catch {
      // non-critical
    }
  }, [state]);

  // ── Main preparation pipeline ──
  const runPreparation = useCallback(async () => {
    if (!state) return;

    setPrepError(null);
    setPrepProgress(0);
    setPrepStatus('Checking compatible models...');

    // Build PDF preview in parallel (non-blocking)
    buildPdfPreview();
    loadResumeText();

    if (!window.electronAPI) {
      // Browser mode — skip model steps
      setPrepProgress(100);
      setPrepStatus('Ready!');
      await new Promise(r => setTimeout(r, 800));
      navigate('/dashboard', { replace: true });
      return;
    }

    try {
      // 1. Fetch compatible models (equivalent to `lemonade-server list`)
      setPrepStatus('Fetching compatible models...');
      setPrepProgress(10);
      const allModels = await window.electronAPI.listAllModels();

      if (allModels.length === 0) {
        setPrepError('No compatible models found for this system. Check Lemonade Server configuration.');
        return;
      }

      // 2. Pick best LLM and ASR
      const { llm, asr } = pickModels(allModels);
      setSelectedLLM(llm);
      setSelectedASR(asr);

      if (!llm) {
        setPrepError('No compatible LLM model found for this system.');
        return;
      }

      console.log('Selected LLM:', llm.id, '| ASR:', asr?.id || 'none');
      setPrepProgress(20);

      // 3. Pull models that aren't downloaded yet
      const modelsToPull: CompatibleModel[] = [];
      if (!llm.downloaded) modelsToPull.push(llm);
      if (asr && !asr.downloaded) modelsToPull.push(asr);

      if (modelsToPull.length > 0) {
        const progressPerModel = 50 / modelsToPull.length;
        for (let i = 0; i < modelsToPull.length; i++) {
          const model = modelsToPull[i];
          setPrepStatus(`Downloading ${model.id}...`);
          const result = await window.electronAPI.pullModel(model.id);
          if (result === false || (result && !result.success)) {
            const msg = result && result.message ? result.message : 'Unknown error';
            setPrepError(`Failed to download ${model.id}: ${msg}`);
            return;
          }
          setPrepProgress(20 + progressPerModel * (i + 1));
        }
      } else {
        setPrepStatus('Models already available');
        setPrepProgress(70);
      }

      // 4. Load the LLM
      setPrepStatus(`Loading ${llm.id}...`);
      setPrepProgress(75);
      const loadResult = await window.electronAPI.loadModel(llm.id);
      if (loadResult === false || (loadResult && !loadResult.success)) {
        const msg = loadResult && loadResult.message ? loadResult.message : 'Unknown error';
        setPrepError(`Failed to load ${llm.id}: ${msg}`);
        return;
      }

      // 5. Load ASR if available
      if (asr) {
        setPrepStatus(`Loading ${asr.id}...`);
        setPrepProgress(85);
        await window.electronAPI.loadModel(asr.id);
      }

      // 6. Update interviewer settings to use the selected model
      setPrepStatus('Configuring interview...');
      setPrepProgress(90);
      await window.electronAPI.updateInterviewerSettings({
        modelName: llm.id,
        asrModel: asr?.id,
      });

      // 7. Start the interview
      setPrepStatus('Starting interview...');
      setPrepProgress(95);

      const interviewConfig = {
        title: state.formData.title,
        company: state.formData.company,
        position: state.formData.position,
        interviewType:
          state.interviewMode === 'single'
            ? state.formData.interviewType
            : ('behavioral' as InterviewType),
      };

      const interview = await window.electronAPI.startInterview(interviewConfig);
      if (!interview) {
        setPrepError('Failed to create interview session.');
        return;
      }

      setPrepProgress(100);
      setPrepStatus('Ready!');
      await new Promise(r => setTimeout(r, 500));

      navigate(`/interview/${interview.id}`, { replace: true });
    } catch (error: any) {
      console.error('Preparation failed:', error);
      setPrepError(error.message || 'An unexpected error occurred during preparation.');
    }
  }, [state, navigate, buildPdfPreview, loadResumeText]);

  // ── Auto-run preparation on mount ──
  useEffect(() => {
    if (state) {
      runPreparation();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null; // guard — will redirect via useEffect above

  return (
    <div className="h-screen w-full bg-lemonade-bg text-lemonade-fg flex flex-col">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-black">prepare for your interview</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {state.formData.title} &middot; {state.formData.company} &middot;{' '}
            {state.formData.position}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedLLM && (
            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
              {selectedLLM.id}
            </span>
          )}
          {selectedASR && (
            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
              {selectedASR.id}
            </span>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Resume PDF viewer */}
        <div className="flex-1 bg-gray-50 flex items-center justify-center p-6">
          {pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              className="w-full h-full rounded-xl border border-gray-200 shadow-sm bg-white"
              title="Resume Preview"
            />
          ) : resumeText ? (
            <div className="w-full max-w-2xl mx-auto">
              <div className="flex items-center gap-2 mb-4 text-gray-500">
                <FileText size={18} />
                <span className="text-sm font-medium">{state.resumeFileName}</span>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6 max-h-[70vh] overflow-y-auto shadow-sm">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {resumeText}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">{state.resumeFileName || 'Your resume'}</p>
              <p className="text-xs mt-1">Review your resume while we set things up</p>
            </div>
          )}
        </div>

        {/* Right: Status panel */}
        <div className="w-80 border-l border-gray-100 p-6 flex flex-col">
          <div className="flex-1">
            <h3 className="text-sm font-bold text-black uppercase tracking-wider mb-6">
              Setting Up
            </h3>

            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex justify-between text-xs font-medium text-gray-500 mb-1.5">
                <span>{prepStatus}</span>
                <span>{prepProgress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-lemonade-accent transition-all duration-500 rounded-full"
                  style={{ width: `${prepProgress}%` }}
                />
              </div>
            </div>

            {/* Model checklist */}
            {selectedLLM && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  {prepProgress >= 70 ? (
                    <Check size={16} className="text-green-500 flex-shrink-0" />
                  ) : prepProgress >= 20 ? (
                    <Download size={16} className="text-lemonade-accent animate-pulse flex-shrink-0" />
                  ) : (
                    <Loader2 size={16} className="text-gray-300 animate-spin flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{selectedLLM.id}</p>
                    <p className="text-xs text-gray-400">language model</p>
                  </div>
                </div>

                {selectedASR && (
                  <div className="flex items-center gap-3 text-sm">
                    {prepProgress >= 85 ? (
                      <Check size={16} className="text-green-500 flex-shrink-0" />
                    ) : prepProgress >= 70 ? (
                      <Download size={16} className="text-lemonade-accent animate-pulse flex-shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-gray-800">{selectedASR.id}</p>
                      <p className="text-xs text-gray-400">speech recognition</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {prepError && (
              <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <p>{prepError}</p>
                </div>
                <button
                  onClick={() => {
                    setPrepError(null);
                    runPreparation();
                  }}
                  className="mt-3 text-xs font-bold uppercase tracking-wider hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Cancel — goes back to landing */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-black transition-colors mt-4"
          >
            <ChevronLeft size={14} />
            cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Preparing;
