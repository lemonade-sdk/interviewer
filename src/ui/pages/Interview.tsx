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
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

type InterviewStage = 'loading' | 'interview';

const Interview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentInterview, setCurrentInterview } = useStore();

  // Voice hint from Preparing page (not a gate — we always try to initialize)
  const voiceHint = (location.state as any)?.voiceEnabled ?? true;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stage management
  const [stage, setStage] = useState<InterviewStage>('loading');
  const [isLoaded, setIsLoaded] = useState(false);

  // Voice state
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

  // Interview timer (seconds)
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDuration, setTimerDuration] = useState(1800); // 30min default, loaded from settings
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTimerWarning = timerSeconds >= timerDuration * 0.8; // 80% threshold
  const isTimerExpired = timerSeconds >= timerDuration;

  // Voice manager instance
  const voiceManagerRef = useRef<VoiceInterviewManager | null>(null);
  const hasInitiatedRef = useRef(false);
  // Ref to track whether we should resume listening after AI finishes speaking
  const shouldResumeListeningRef = useRef(false);

  // ─── Timer formatting ───────────────────────────────────
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
      // Load timer duration from settings
      window.electronAPI?.getSettings().then((s) => {
        if (s?.defaultInterviewDuration) {
          setTimerDuration(s.defaultInterviewDuration * 60); // convert minutes to seconds
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

  // Start timer when interview stage begins
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

  // Auto-end when timer expires
  useEffect(() => {
    if (isTimerExpired && id) {
      handleEndInterview(true); // auto-end
    }
  }, [isTimerExpired]);

  // TTS Initiation + auto hands-free
  useEffect(() => {
    if (stage === 'interview' && voiceReady && !hasInitiatedRef.current) {
      hasInitiatedRef.current = true;
      if (messages.length === 0) {
        // Fresh interview: AI speaks first, then hands-free starts inside handleTTSInitiation
        handleTTSInitiation();
      } else {
        // Resumed interview with existing messages: go straight to hands-free
        startHandsFreeMode();
      }
    }
  }, [stage, voiceReady, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTranscribing, isThinking, transcriptionDelta]);

  // Auto-save transcript
  useEffect(() => {
    if (id && messages.length > 0 && currentInterview) {
      const timeoutId = setTimeout(() => saveTranscript(), 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, id]);

  // Transition to interview stage
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
        // ─── Streaming path: AI speaks as tokens arrive ────
        const assistantMsgId = (Date.now() + 1).toString();
        let accumulatedText = '';

        manager.startStreamingPipeline();

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
        // ─── Non-streaming: muted ──────────────────────────
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
      // Persona loading is non-critical
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
        
        // Fetch WebSocket port from Lemonade Server
        wsPort = await window.electronAPI.getWebSocketPort();
        console.log('WebSocket port for real-time ASR:', wsPort);
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

      // Wire events
      manager.on('recording-started', () => setIsRecording(true));
      manager.on('recording-stopped', () => {
        setIsRecording(false);
        setTranscriptionDelta('');
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
        setTranscriptionDelta('');
        // Only auto-send in non-hands-free mode (tap-to-speak)
        // In hands-free mode, 'utterance-complete' handles submission
        if (!manager.isHandsFreeMode && text.trim() && id) {
          await sendVoiceMessage(text);
        }
      });

      // ── Hands-free mode events ──
      manager.on('utterance-complete', async (text: string) => {
        console.log('Hands-free utterance received:', text);
        setTranscriptionDelta('');
        if (text.trim() && id) {
          await sendVoiceMessage(text);
        }
      });
      manager.on('listening-started', () => {
        setIsListening(true);
        setIsRecording(true);
      });
      manager.on('listening-stopped', () => {
        setIsListening(false);
        setTranscriptionDelta('');
      });

      manager.on('speaking-started', () => setIsSpeaking(true));
      manager.on('speaking-stopped', () => setIsSpeaking(false));
      manager.on('error', (error: Error) => {
        console.error('Voice error:', error);
      });

      await manager.initialize();
      voiceManagerRef.current = manager;
      setVoiceReady(true);
      console.log('Voice manager initialized');
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

    // Pause hands-free listening while AI processes + speaks
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

    // ─── Streaming path: voice mode with TTS pipelining ──────
    // Tokens are streamed from the LLM and fed into the sentence
    // chunker → TTS queue so the AI starts speaking within seconds.
    const useStreaming = voiceMode && manager && !isMuted;

    if (useStreaming) {
      // Prepare a placeholder assistant message that updates as tokens arrive
      const assistantMsgId = (Date.now() + 1).toString();
      let accumulatedText = '';

      try {
        setIsThinking(true);

        // Start the TTS pipeline BEFORE tokens arrive
        manager.startStreamingPipeline();

        // Register the token listener — feeds each token to the chunker
        window.electronAPI.onLLMToken((token: string) => {
          accumulatedText += token;
          manager.feedToken(token);
          // Update the assistant message in the UI as tokens arrive (typewriter)
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

        // Start the streaming IPC — resolves when the LLM finishes
        setIsThinking(false); // LLM is now streaming, no longer "thinking"
        const response = await window.electronAPI.sendMessageStreaming(id, text);

        // Flush remaining buffered text to TTS
        manager.flushRemainingText();

        // Ensure the final message content uses the cleaned response from main process
        if (response) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, content: response.content } : m,
            ),
          );
        }

        // Wait for TTS queue to finish playing all sentences
        await manager.waitForTTSQueueDrain();

        // Clean up listeners
        window.electronAPI.offLLMToken();
        window.electronAPI.offLLMDone();

        await loadInterview();

        // Resume hands-free listening
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

    // ─── Non-streaming path: text mode or muted ─────────────
    try {
      setIsThinking(true);
      const response = await window.electronAPI.sendMessage(id, text);
      setIsThinking(false);
      setMessages((prev) => [...prev, response]);

      await loadInterview();

      // Resume hands-free listening after response
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
      // If AI is speaking, interrupt it
      if (isSpeaking) {
        manager.stopSpeaking();
        // If in hands-free mode, start listening now
        if (isHandsFreeMode) {
          await manager.resumeHandsFreeListening();
        }
        return;
      }

      // Toggle hands-free mode
      if (isHandsFreeMode) {
        // Currently in hands-free mode — exit it
        manager.exitHandsFreeMode();
        setIsHandsFreeMode(false);
        setIsListening(false);
      } else {
        // Enter hands-free mode
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

    // Stop voice manager
    if (voiceManagerRef.current) {
      voiceManagerRef.current.cleanup();
      voiceManagerRef.current = null;
    }
    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    try {
      await window.electronAPI.endInterview(id);
      // Navigate to feedback page for detailed Q/A scoring
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
      <div className="flex flex-col h-full bg-background items-center justify-center">
        <div className="relative w-20 h-20 mb-8">
          <div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-primary to-primary/70"
            style={{ animation: 'orbBreathe 2s ease-in-out infinite' }}
          />
          <div
            className="absolute rounded-full border-2 border-primary/20"
            style={{ inset: '-8px', animation: 'spin 3s linear infinite' }}
          />
        </div>
        <p className="text-sm font-medium text-muted-foreground tracking-wide">
          Preparing your interview...
        </p>
      </div>
    );
  }

  // ─── Interview UI ─────────────────────────────────────────
  const visibleMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden">
      {/* Persona Selector Modal */}
      {showPersonaSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <PersonaSelector
              selectedPersonaId={selectedPersona?.id}
              onSelect={handlePersonaSelect}
              onClose={() => setShowPersonaSelector(false)}
            />
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold truncate">
              {currentInterview.title}
            </h1>
            <p className="text-[11px] text-muted-foreground truncate">
              {currentInterview.company} &middot; {currentInterview.position}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Timer */}
          <Badge
            variant="outline"
            className={cn(
              'gap-1 font-mono text-xs tabular-nums',
              isTimerExpired
                ? 'border-destructive text-destructive animate-pulse'
                : isTimerWarning
                  ? 'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                  : 'border-border text-muted-foreground'
            )}
          >
            <Clock size={12} />
            {formatTime(remainingTime)}
          </Badge>

          {/* Toggle text input */}
          <Button
            variant={showTextInput ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => setShowTextInput(!showTextInput)}
            title="Toggle text input"
          >
            <Keyboard size={16} />
          </Button>

          {/* Mute toggle */}
          <Button
            variant={isMuted ? 'destructive' : 'ghost'}
            size="icon-sm"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </Button>

          {/* Audio Settings */}
          <Button
            variant={showAudioSettings ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => setShowAudioSettings(!showAudioSettings)}
            title="Audio settings"
          >
            <Settings size={16} />
          </Button>

          {/* End Interview */}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleEndInterview(false)}
            className="ml-2 gap-1.5"
          >
            <StopCircle size={14} />
            End
          </Button>
        </div>
      </header>

      {/* Audio Settings Panel */}
      {showAudioSettings && (
        <div className="border-b border-border bg-card px-5 py-3">
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
                'radial-gradient(ellipse 60% 50% at 50% 45%, hsl(var(--primary) / 0.03) 0%, transparent 100%)',
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
          {voiceReady && isHandsFreeMode && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-500 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
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
            <div className="mt-3 text-[11px] text-muted-foreground/40">
              Starting hands-free mode...
            </div>
          )}

          {!voiceReady && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
              <MicOff size={12} />
              <span>Voice unavailable — use text input</span>
            </div>
          )}
        </div>

        {/* ── Transcript Area ── */}
        <div className="h-[42%] min-h-[200px] flex flex-col border-t border-border">
          {/* Status bar */}
          <div className="px-5 py-2 flex items-center justify-between border-b border-border/50">
            <span className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
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
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {visibleMessages.length === 0 && !isThinking && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground/30">
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
                <div className="bg-primary/5 border border-primary/10 rounded-xl rounded-br-sm px-4 py-2.5">
                  <p className="text-sm text-primary/60 italic">{transcriptionDelta}</p>
                </div>
              </div>
            )}

            {/* Transcribing indicator */}
            {isTranscribing && !transcriptionDelta && (
              <div className="flex justify-end">
                <div className="bg-primary/10 border border-primary/20 rounded-xl rounded-br-sm px-4 py-2.5 flex items-center gap-2">
                  <div className="flex items-center gap-[3px]">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-[3px] bg-primary/50 rounded-full"
                        style={{
                          height: `${8 + i * 2}px`,
                          animation: `pulse 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-primary/70">Processing speech...</span>
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-muted-foreground/30 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground/50">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Text input — togglable */}
          {showTextInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (textInput.trim()) {
                  handleSendMessage(textInput);
                  setTextInput('');
                }
              }}
              className="px-4 py-2.5 border-t border-border/50 flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending}
                className="flex-1 px-4 py-2 text-sm bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/50 disabled:opacity-40 transition-colors"
              />
              <Button
                type="submit"
                disabled={isSending || !textInput.trim()}
                size="icon"
              >
                <Send size={16} />
              </Button>
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
    <span className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
      <span className={`w-1.5 h-1.5 rounded-full ${colorMap[color]} animate-pulse`} />
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[75%] min-w-[60px]">
        <div
          className={cn(
            'px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-xl rounded-br-sm'
              : 'bg-muted text-foreground rounded-xl rounded-bl-sm'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className={`text-[10px] text-muted-foreground/40 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {format(new Date(message.timestamp), 'h:mm a')}
        </p>
      </div>
    </div>
  );
};

export default Interview;
