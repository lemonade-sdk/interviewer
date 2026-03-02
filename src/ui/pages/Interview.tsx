import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  StopCircle,
  Settings,
  Send,
  Volume2,
  VolumeX,
  ArrowLeft,
  Keyboard,
  MicOff,
  Clock,
  User,
  Bot
} from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  Message,
  AgentPersona,
  AudioSettings as AudioSettingsType,
  DEFAULT_VAD_CONFIG,
  DEFAULT_ASR_CONFIG,
} from '../../types';
import { format } from 'date-fns';
import { PersonaSelector } from '../components/PersonaSelector';
import { AudioSettings } from '../components/AudioSettings';
import { VoiceOrb } from '../components/VoiceOrb';
import { VoiceInterviewManager } from '../../services/VoiceInterviewManager';
import { LemonBadge, LemonDialog } from '../components/lemon';
import { cn } from '@ui/lib';

type InterviewStage = 'loading' | 'interview';

const Interview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentInterview, setCurrentInterview } = useStore();

  const voiceHint = (location.state as any)?.voiceEnabled ?? true;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [stage, setStage] = useState<InterviewStage>('loading');
  const [isLoaded, setIsLoaded] = useState(false);

  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<AgentPersona | null>(null);
  const [voiceMode] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isVADActive, setIsVADActive] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voiceReady, setVoiceReady] = useState(false);
  const [showTextInput, setShowTextInput] = useState(!voiceHint);
  const [transcriptionDelta, setTranscriptionDelta] = useState('');
  const [isHandsFreeMode, setIsHandsFreeMode] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDuration, setTimerDuration] = useState(1800);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTimerWarning = timerSeconds >= timerDuration * 0.8;
  const isTimerExpired = timerSeconds >= timerDuration;

  const voiceManagerRef = useRef<VoiceInterviewManager | null>(null);
  const hasInitiatedRef = useRef(false);
  const shouldResumeListeningRef = useRef(false);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  const remainingTime = Math.max(0, timerDuration - timerSeconds);

  // ─── Effects ──────────────────────────────────────────────
  useEffect(() => {
    if (id) {
      loadInterview();
      loadDefaultPersona();
      initializeVoiceManager();
      window.electronAPI?.getSettings().then((s) => {
        if (s?.defaultInterviewDuration) {
          setTimerDuration(s.defaultInterviewDuration * 60);
        }
      }).catch(() => {});
    }
    return () => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.cleanup();
        voiceManagerRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [id]);

  useEffect(() => {
    if (stage === 'interview' && !timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current && stage !== 'interview') {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [stage]);

  useEffect(() => {
    if (isTimerExpired && id) {
      handleEndInterview(true);
    }
  }, [isTimerExpired]);

  useEffect(() => {
    if (stage === 'interview' && voiceReady && !hasInitiatedRef.current) {
      hasInitiatedRef.current = true;
      if (messages.length === 0) {
        handleTTSInitiation();
      } else {
        startHandsFreeMode();
      }
    }
  }, [stage, voiceReady, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTranscribing, isThinking, transcriptionDelta]);

  useEffect(() => {
    if (id && messages.length > 0 && currentInterview) {
      const timeoutId = setTimeout(() => saveTranscript(), 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, id]);

  useEffect(() => {
    if (currentInterview && !isLoaded) {
      const timer = setTimeout(() => {
        setIsLoaded(true);
        setStage('interview');
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [currentInterview, isLoaded]);

  // ─── Core functions ───────────────────────────────────────
  const handleTTSInitiation = async () => {
    if (!id || !voiceManagerRef.current) return;
    const manager = voiceManagerRef.current;
    const greetingText = "Hello, I am ready to start the interview. Please introduce yourself and let's begin.";

    try {
      setIsThinking(true);

      if (!isMuted) {
        const assistantMsgId = (Date.now() + 1).toString();
        let accumulatedText = '';

        await manager.startStreamingPipeline();

        window.electronAPI.onLLMToken((token: string) => {
          accumulatedText += token;
          manager.feedToken(token);
          setMessages((prev) => {
            const existing = prev.find((m) => m.id === assistantMsgId);
            if (existing) {
              return prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: accumulatedText } : m,
              );
            }
            return [
              ...prev,
              {
                id: assistantMsgId,
                role: 'assistant' as const,
                content: accumulatedText,
                timestamp: new Date().toISOString(),
              },
            ];
          });
        });

        setIsThinking(false);
        const response = await window.electronAPI.sendMessageStreaming(id, greetingText);

        manager.flushRemainingText();

        if (response) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: response.content } : m,
            ),
          );
        }

        await manager.waitForTTSQueueDrain();

        window.electronAPI.offLLMToken();
        window.electronAPI.offLLMDone();

        shouldResumeListeningRef.current = true;
        await startHandsFreeMode();
      } else {
        const response = await window.electronAPI.sendMessage(id, greetingText);
        setIsThinking(false);
        setMessages((prev) => [...prev, response]);
        await startHandsFreeMode();
      }
    } catch (error) {
      console.error('Failed to initiate interview with TTS:', error);
      setIsThinking(false);
      window.electronAPI.offLLMToken?.();
      window.electronAPI.offLLMDone?.();
      await startHandsFreeMode();
    }
  };

  const startHandsFreeMode = async () => {
    const manager = voiceManagerRef.current;
    if (!manager) return;
    try {
      setIsHandsFreeMode(true);
      await manager.startHandsFreeListening();
    } catch (error) {
      console.error('Failed to start hands-free listening:', error);
      setIsHandsFreeMode(false);
    }
  };

  const saveTranscript = async () => {
    if (!id || messages.length === 0) return;
    try {
      await window.electronAPI.updateInterviewTranscript(id, messages);
    } catch (error) {
      console.error('Failed to auto-save transcript:', error);
    }
  };

  const loadInterview = async () => {
    if (!id) return;
    try {
      const interview = await window.electronAPI.getInterview(id);
      if (!interview) throw new Error('Interview session not found.');
      setCurrentInterview(interview);
      if (interview.transcript?.length > 0) {
        setMessages(interview.transcript);
      }
    } catch (error: any) {
      console.error('Failed to load interview:', error);
      navigate('/dashboard');
    }
  };

  const loadDefaultPersona = async () => {
    try {
      const defaultPersona = await window.electronAPI.getDefaultPersona();
      if (defaultPersona) setSelectedPersona(defaultPersona);
    } catch {
    }
  };

  // ─── Voice manager ───────────────────────────────────────
  const initializeVoiceManager = async () => {
    try {
      const defaultAudioSettings: AudioSettingsType = {
        inputVolume: 100,
        outputVolume: 100,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      let asrModel: 'Whisper-Tiny' | 'Whisper-Base' | 'Whisper-Small' = 'Whisper-Base';
      let wsPort: number | null = null;
      try {
        const settings = await window.electronAPI.getInterviewerSettings();
        if (settings?.asrModel) {
          const valid = ['Whisper-Tiny', 'Whisper-Base', 'Whisper-Small'];
          if (valid.includes(settings.asrModel)) {
            asrModel = settings.asrModel as typeof asrModel;
          }
        }
        wsPort = await window.electronAPI.getWebSocketPort();
      } catch (err) {
        console.warn('Failed to fetch settings or wsPort:', err);
      }

      const manager = new VoiceInterviewManager(
        defaultAudioSettings,
        'http://localhost:8000/api/v1',
        asrModel,
        wsPort || undefined,
        DEFAULT_VAD_CONFIG,
        DEFAULT_ASR_CONFIG,
      );

      manager.on('recording-started', () => setIsRecording(true));
      manager.on('recording-stopped', () => {
        setIsRecording(false);
      });
      manager.on('audio-level', (level: number) => setAudioLevel(level));
      manager.on('speech-detected', () => setIsVADActive(true));
      manager.on('speech-ended', () => setIsVADActive(false));
      manager.on('transcription-started', () => setIsTranscribing(true));
      manager.on('transcription-delta', (delta: string) => {
        setTranscriptionDelta(delta);
      });
      manager.on('transcription-complete', async (text: string) => {
        setIsTranscribing(false);
        // Don't clear transcriptionDelta here - keep it visible until message appears
        if (!manager.isHandsFreeMode && text.trim() && id) {
          await sendVoiceMessage(text);
        } else if (!text.trim()) {
          setTranscriptionDelta('');
        }
      });

      manager.on('utterance-complete', async (text: string) => {
        // Don't clear transcriptionDelta here - keep it visible until message appears
        if (text.trim() && id) {
          await sendVoiceMessage(text);
        } else if (!text.trim()) {
          setTranscriptionDelta('');
        }
      });
      manager.on('listening-started', () => {
        setIsListening(true);
        setIsRecording(true);
      });
      manager.on('listening-stopped', () => {
        setIsListening(false);
        // Don't clear transcriptionDelta here - it will be cleared when message is added
      });

      manager.on('speaking-started', () => setIsSpeaking(true));
      manager.on('speaking-stopped', () => setIsSpeaking(false));
      manager.on('error', (error: Error) => {
        console.error('Voice error:', error);
      });

      await manager.initialize();
      
      // Apply TTS rate from settings
      try {
        const settings = await window.electronAPI.getInterviewerSettings();
        if (settings?.ttsRate !== undefined) {
          manager.updateTTSSettings({ rate: settings.ttsRate });
          console.log(`[Interview] Applied TTS rate: ${settings.ttsRate}x`);
        }
      } catch (err) {
        console.warn('Failed to apply TTS rate from settings:', err);
      }
      
      voiceManagerRef.current = manager;
      setVoiceReady(true);
    } catch (error) {
      console.error('Voice manager initialization failed:', error);
      setVoiceReady(false);
      setShowTextInput(true);
    }
  };

  // ─── Messaging ────────────────────────────────────────────
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !id || isSending) return;
    setIsSending(true);
    await sendTextMessage(text);
    setIsSending(false);
  };

  const sendTextMessage = async (text: string) => {
    if (!id) return;
    const manager = voiceManagerRef.current;

    if (manager?.isHandsFreeMode && manager.getState().isRecording) {
      manager.stopHandsFreeListening(false);
    }

    const tempUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    
    // Clear transcription delta now that the message is in the UI
    setTranscriptionDelta('');

    const useStreaming = voiceMode && manager && !isMuted;

    if (useStreaming) {
      const assistantMsgId = (Date.now() + 1).toString();
      let accumulatedText = '';

      try {
        setIsThinking(true);
        await manager.startStreamingPipeline();

        window.electronAPI.onLLMToken((token: string) => {
          accumulatedText += token;
          manager.feedToken(token);
          setMessages((prev) => {
            const existing = prev.find((m) => m.id === assistantMsgId);
            if (existing) {
              return prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: accumulatedText } : m,
              );
            }
            return [
              ...prev,
              {
                id: assistantMsgId,
                role: 'assistant' as const,
                content: accumulatedText,
                timestamp: new Date().toISOString(),
              },
            ];
          });
        });

        setIsThinking(false);
        const response = await window.electronAPI.sendMessageStreaming(id, text);
        manager.flushRemainingText();

        if (response) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: response.content } : m,
            ),
          );
        }

        await manager.waitForTTSQueueDrain();
        window.electronAPI.offLLMToken();
        window.electronAPI.offLLMDone();
        await loadInterview();

        if (manager.isHandsFreeMode) {
          try {
            await manager.resumeHandsFreeListening();
          } catch (error) {
            console.error('Failed to resume hands-free listening:', error);
          }
        }
      } catch (error) {
        console.error('Streaming message failed:', error);
        setIsThinking(false);
        window.electronAPI.offLLMToken();
        window.electronAPI.offLLMDone();
        window.electronAPI.offLLMError();
        manager.stopSpeaking();

        if (manager.isHandsFreeMode) {
          try {
            await manager.resumeHandsFreeListening();
          } catch (e) {
            console.error('Failed to resume listening after error:', e);
          }
        }
      } finally {
        setIsSending(false);
      }
      return;
    }

    try {
      setIsThinking(true);
      const response = await window.electronAPI.sendMessage(id, text);
      setIsThinking(false);
      setMessages((prev) => [...prev, response]);
      await loadInterview();

      if (manager?.isHandsFreeMode) {
        try {
          await manager.resumeHandsFreeListening();
        } catch (error) {
          console.error('Failed to resume hands-free listening:', error);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsThinking(false);
      if (manager?.isHandsFreeMode) {
        try {
          await manager.resumeHandsFreeListening();
        } catch (e) {
          console.error('Failed to resume listening after error:', e);
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  const sendVoiceMessage = async (text: string) => {
    if (!id) return;
    setIsSending(true);
    await sendTextMessage(text);
    setIsSending(false);
  };

  // ─── Actions ──────────────────────────────────────────────
  const handleOrbClick = async () => {
    const manager = voiceManagerRef.current;
    if (!manager) {
      setShowTextInput(true);
      return;
    }

    try {
      if (isSpeaking) {
        manager.stopSpeaking();
        if (isHandsFreeMode) {
          await manager.resumeHandsFreeListening();
        }
        return;
      }

      if (isHandsFreeMode) {
        manager.exitHandsFreeMode();
        setIsHandsFreeMode(false);
        setIsListening(false);
      } else {
        await startHandsFreeMode();
      }
    } catch (error: any) {
      console.error('Orb click handler failed:', error);
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    if (voiceManagerRef.current?.getState().isSpeaking) {
      voiceManagerRef.current.stopSpeaking();
    }
  };

  const handleEndInterview = async (autoEnd = false) => {
    if (!id) return;

    if (!autoEnd) {
      const confirmed = window.confirm(
        'End this interview? You will receive feedback on your performance.'
      );
      if (!confirmed) return;
    }

    if (voiceManagerRef.current) {
      voiceManagerRef.current.cleanup();
      voiceManagerRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      await window.electronAPI.endInterview(id);
      navigate(`/feedback/${id}`, { replace: true });
    } catch (error) {
      console.error('Failed to end interview:', error);
      navigate('/dashboard');
    }
  };

  const handlePersonaSelect = (persona: AgentPersona) => {
    setSelectedPersona(persona);
    setShowPersonaSelector(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // ─── Loading state ────────────────────────────────────────
  if (!currentInterview || stage === 'loading') {
    return (
      <div className="flex flex-col h-full bg-lemonade-bg dark:bg-lemonade-dark-bg items-center justify-center transition-colors duration-300">
        <div className="relative w-20 h-20 mb-8">
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-lemonade-accent to-lemonade-accent-hover"
            style={{ animation: 'orbBreathe 2s ease-in-out infinite' }}
          />
          <div
            className="absolute rounded-full border-2 border-lemonade-accent/20"
            style={{ inset: '-8px', animation: 'spin 3s linear infinite' }}
          />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-white/50 tracking-wide">
          Preparing your interview...
        </p>
      </div>
    );
  }

  // ─── Interview UI ─────────────────────────────────────────
  const visibleMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div className="flex flex-col h-full bg-lemonade-bg dark:bg-lemonade-dark-bg text-black dark:text-white overflow-hidden transition-colors duration-300">
      {/* Persona Selector Dialog */}
      <LemonDialog
        open={showPersonaSelector}
        onClose={() => setShowPersonaSelector(false)}
        title="Select Interviewer Persona"
        subtitle={<span className="text-xs text-gray-500">Choose the personality and style of your interviewer.</span>}
        className="max-w-4xl"
      >
        <div className="p-6">
          <PersonaSelector
            selectedPersonaId={selectedPersona?.id}
            onSelect={handlePersonaSelect}
            onClose={() => setShowPersonaSelector(false)}
          />
        </div>
      </LemonDialog>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-gray-200/50 dark:border-white/[0.08] bg-lemonade-bg dark:bg-lemonade-dark-surface transition-colors duration-300">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors text-gray-400 hover:text-black dark:hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold truncate">
                {currentInterview.title}
              </h1>
              <LemonBadge variant="outline">
                {currentInterview.interviewType}
              </LemonBadge>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-white/40 truncate">
              {currentInterview.company} &middot; {currentInterview.position}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Timer */}
          <span className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl font-mono text-xs tabular-nums transition-colors",
            isTimerExpired
              ? "border-red-500 text-red-500 dark:text-red-400 animate-pulse"
              : isTimerWarning
                ? "border-yellow-400 text-yellow-600 dark:text-yellow-400"
                : "border-gray-200/60 dark:border-white/10 text-gray-500 dark:text-white/50"
          )}>
            <Clock size={12} />
            {formatTime(remainingTime)}
          </span>

          {/* Toggle text input */}
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            title="Toggle text input"
            className={cn(
              "p-2 rounded-xl transition-colors",
              showTextInput
                ? "bg-lemonade-accent/15 text-lemonade-accent-hover"
                : "text-gray-400 dark:text-white/40 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-black dark:hover:text-white"
            )}
          >
            <Keyboard size={16} />
          </button>

          {/* Mute toggle */}
          <button
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
            className={cn(
              "p-2 rounded-xl transition-colors",
              isMuted
                ? "bg-red-500/15 text-red-500"
                : "text-gray-400 dark:text-white/40 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-black dark:hover:text-white"
            )}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Audio Settings */}
          <button
            onClick={() => setShowAudioSettings(!showAudioSettings)}
            title="Audio settings"
            className={cn(
              "p-2 rounded-xl transition-colors",
              showAudioSettings
                ? "bg-lemonade-accent/15 text-lemonade-accent-hover"
                : "text-gray-400 dark:text-white/40 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-black dark:hover:text-white"
            )}
          >
            <Settings size={16} />
          </button>

          {/* End Interview */}
          <button
            onClick={() => handleEndInterview(false)}
            className="ml-1 flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold hover:bg-red-500/20 transition-colors"
          >
            <StopCircle size={14} />
            End
          </button>
        </div>
      </header>

      {/* Audio Settings Panel */}
      {showAudioSettings && (
        <div className="border-b border-gray-200/50 dark:border-white/[0.08] bg-lemonade-bg dark:bg-lemonade-dark-surface px-5 py-3 transition-colors duration-300">
          <AudioSettings />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Voice Orb Area */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[240px] relative">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,215,68,0.04) 0%, transparent 100%)',
            }}
          />

          <VoiceOrb
            isListening={isRecording || isListening}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            isVADActive={isVADActive}
            isTranscribing={isTranscribing}
            isThinking={isThinking}
            onClick={handleOrbClick}
            disabled={isSending && !isRecording && !isHandsFreeMode}
          />

          {/* Mode indicator below orb */}
          <div className="mt-4 h-8 flex items-center justify-center">
            {voiceReady && isHandsFreeMode && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {isListening
                    ? 'Listening — speak naturally'
                    : isSpeaking
                      ? 'AI is speaking...'
                      : isThinking
                        ? 'AI is thinking...'
                        : 'Hands-free mode active'}
                </span>
              </div>
            )}

            {voiceReady && !isHandsFreeMode && !isRecording && !isSpeaking && !isThinking && (
              <p className="text-[11px] text-gray-400 dark:text-white/30">
                Starting hands-free mode...
              </p>
            )}

            {!voiceReady && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-white/40">
                <MicOff size={12} />
                <span>Voice unavailable — use text input</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Transcript Area ── */}
        <div className="h-[45%] min-h-[240px] flex flex-col border-t border-gray-200/50 dark:border-white/[0.08]">
          {/* Status bar */}
          <div className="px-6 py-2.5 flex items-center justify-between border-b border-gray-100/60 dark:border-white/[0.04]">
            <span className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wider">
              Transcript
            </span>
            <div className="flex items-center gap-3">
              {isHandsFreeMode && <StatusDot color="green" label="Hands-free" />}
              {isListening && <StatusDot color="yellow" label="Listening" />}
              {isRecording && !isHandsFreeMode && <StatusDot color="red" label="Recording" />}
              {isTranscribing && <StatusDot color="amber" label="Transcribing" />}
              {isThinking && <StatusDot color="purple" label="Generating" />}
              {isSpeaking && <StatusDot color="yellow" label="Speaking" />}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {visibleMessages.length === 0 && !isThinking && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400 dark:text-white/30">
                  Your conversation will appear here
                </p>
              </div>
            )}

            {visibleMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Real-time transcription delta */}
            {transcriptionDelta && (
              <div className="flex justify-end">
                <div className="max-w-[75%] bg-lemonade-accent/10 dark:bg-lemonade-accent/5 border border-lemonade-accent/20 dark:border-lemonade-accent/10 rounded-2xl rounded-br-sm px-4 py-2.5">
                  <p className="text-sm text-lemonade-accent-hover dark:text-lemonade-accent/60 italic">{transcriptionDelta}</p>
                </div>
              </div>
            )}

            {/* Transcribing indicator */}
            {isTranscribing && !transcriptionDelta && (
              <div className="flex justify-end">
                <div className="bg-lemonade-accent/10 border border-lemonade-accent/20 rounded-2xl rounded-br-sm px-4 py-2.5 flex items-center gap-2">
                  <div className="flex items-center gap-[3px]">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-[3px] bg-lemonade-accent/50 rounded-full"
                        style={{
                          height: `${8 + i * 2}px`,
                          animation: `pulse 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-lemonade-accent-hover dark:text-lemonade-accent/70">Processing speech...</span>
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-white/[0.04] rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-gray-400 dark:bg-white/30 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-white/50">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Text input */}
          {showTextInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (textInput.trim()) {
                  handleSendMessage(textInput);
                  setTextInput('');
                }
              }}
              className="px-5 py-3 border-t border-gray-100/60 dark:border-white/[0.04] flex items-center gap-2.5"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending}
                className="flex-1 px-4 py-2.5 text-sm bg-lemonade-bg/50 dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/10 rounded-2xl text-black dark:text-white placeholder-gray-400 dark:placeholder-white/20 focus:outline-none focus:border-lemonade-accent focus:ring-2 focus:ring-lemonade-accent/10 disabled:opacity-40 transition-colors"
              />
              <button
                type="submit"
                disabled={isSending || !textInput.trim()}
                className="p-2.5 bg-lemonade-accent text-black rounded-2xl hover:bg-lemonade-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ────────────────────────────────────────

interface StatusDotProps {
  color: 'red' | 'amber' | 'purple' | 'yellow' | 'green';
  label: string;
}

const StatusDot: React.FC<StatusDotProps> = ({ color, label }) => {
  const colorMap = {
    red: 'bg-red-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-400',
    yellow: 'bg-yellow-400',
    green: 'bg-emerald-400',
  };

  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 dark:text-white/40 uppercase tracking-wider">
      <span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", colorMap[color])} />
      {label}
    </span>
  );
};

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center shrink-0 mt-0.5 text-gray-400">
          <Bot size={15} />
        </div>
      )}
      <div className="max-w-[75%] min-w-[80px]">
        <div
          className={cn(
            "px-4 py-3 text-sm leading-[1.7]",
            isUser
              ? "bg-lemonade-accent text-black rounded-2xl rounded-br-sm"
              : "bg-gray-100 dark:bg-white/[0.05] text-black dark:text-white rounded-2xl rounded-bl-sm"
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className={cn("text-[11px] text-gray-400 dark:text-white/30 mt-1.5 px-1", isUser ? "text-right" : "text-left")}>
          {format(new Date(message.timestamp), 'h:mm a')}
        </p>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-xl bg-lemonade-accent flex items-center justify-center shrink-0 mt-0.5 text-black">
          <User size={15} />
        </div>
      )}
    </div>
  );
};

export default Interview;
