import React, { useEffect, useState, useRef } from 'react';
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

  // Voice manager instance
  const voiceManagerRef = useRef<VoiceInterviewManager | null>(null);
  const hasInitiatedRef = useRef(false);
  // Ref to track whether we should resume listening after AI finishes speaking
  const shouldResumeListeningRef = useRef(false);

  // ─── Effects ──────────────────────────────────────────────
  useEffect(() => {
    if (id) {
      loadInterview();
      loadDefaultPersona();
      initializeVoiceManager();
    }
    return () => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.cleanup();
        voiceManagerRef.current = null;
      }
    };
  }, [id]);

  // TTS Initiation
  useEffect(() => {
    if (stage === 'interview' && !hasInitiatedRef.current && messages.length === 0 && voiceReady) {
      hasInitiatedRef.current = true;
      handleTTSInitiation();
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
    
    try {
      setIsThinking(true);
      // Request the first message from the AI (interviewer starts)
      const response = await window.electronAPI.sendMessage(id, "Hello, I am ready to start the interview. Please introduce yourself and let's begin.");
      setIsThinking(false);
      setMessages((prev) => [...prev, response]);

      if (!isMuted) {
        // Mark that we should resume listening after TTS finishes
        shouldResumeListeningRef.current = true;
        await voiceManagerRef.current.speak(response.content);
        // TTS finished → start hands-free listening
        await startHandsFreeMode();
      } else {
        // Muted — still start listening so user can speak
        await startHandsFreeMode();
      }
    } catch (error) {
      console.error('Failed to initiate interview with TTS:', error);
      setIsThinking(false);
      // Try to start listening even if TTS failed
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

    try {
      setIsThinking(true);
      const response = await window.electronAPI.sendMessage(id, text);
      setIsThinking(false);
      setMessages((prev) => [...prev, response]);

      // TTS playback if voice mode and not muted
      if (voiceMode && manager && !isMuted) {
        try {
          await manager.speak(response.content);
        } catch (error) {
          console.error('TTS playback failed:', error);
        }
      }

      await loadInterview();

      // Resume hands-free listening after AI finishes speaking
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
      // Still try to resume listening on error
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

  const handleEndInterview = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      'End this interview? You will receive feedback on your performance.'
    );
    if (confirmed) {
      try {
        await window.electronAPI.endInterview(id);
        navigate('/dashboard');
      } catch (error) {
        console.error('Failed to end interview:', error);
      }
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
      <div className="flex flex-col h-full bg-[#141413] items-center justify-center">
        <div className="relative w-20 h-20 mb-8">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #FFD744, #E59800)',
              animation: 'orbBreathe 2s ease-in-out infinite',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: '-8px',
              border: '1.5px solid rgba(255,215,68,0.2)',
              animation: 'spin 3s linear infinite',
            }}
          />
        </div>
        <p className="text-sm font-medium text-white/50 tracking-wide">
          Preparing your interview...
        </p>
      </div>
    );
  }

  // ─── Interview UI ─────────────────────────────────────────
  const visibleMessages = messages.filter((m) => m.role !== 'system');

  return (
    <div className="flex flex-col h-full bg-[#141413] text-white overflow-hidden">
      {/* Persona Selector Modal */}
      {showPersonaSelector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1c1c1a] border border-white/10 rounded-2xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <PersonaSelector
              selectedPersonaId={selectedPersona?.id}
              onSelect={handlePersonaSelect}
              onClose={() => setShowPersonaSelector(false)}
            />
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-white/80 truncate">
              {currentInterview.title}
            </h1>
            <p className="text-[11px] text-white/30 truncate">
              {currentInterview.company} &middot; {currentInterview.position}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Toggle text input */}
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className={`p-2 rounded-lg transition-colors ${
              showTextInput
                ? 'text-lemonade-accent bg-lemonade-accent/10'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
            }`}
            title="Toggle text input"
          >
            <Keyboard size={16} />
          </button>

          {/* Mute toggle */}
          <button
            onClick={handleToggleMute}
            className={`p-2 rounded-lg transition-colors ${
              isMuted
                ? 'text-red-400 bg-red-400/10'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Audio Settings */}
          <button
            onClick={() => setShowAudioSettings(!showAudioSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showAudioSettings
                ? 'text-lemonade-accent bg-lemonade-accent/10'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5'
            }`}
            title="Audio settings"
          >
            <Settings size={16} />
          </button>

          {/* End Interview */}
          <button
            onClick={handleEndInterview}
            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors"
          >
            <StopCircle size={14} />
            End
          </button>
        </div>
      </header>

      {/* Audio Settings Panel */}
      {showAudioSettings && (
        <div className="border-b border-white/[0.06] bg-[#1a1a18] px-5 py-3">
          <AudioSettings />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Voice Orb Area */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[240px] relative">
          {/* Subtle radial background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(255,215,68,0.03) 0%, transparent 100%)',
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
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-400/70 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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

          {voiceReady && !isHandsFreeMode && !isRecording && (
            <div className="mt-3 text-[11px] text-white/20">
              Tap the orb to start hands-free conversation
            </div>
          )}

          {/* Voice not ready indicator */}
          {!voiceReady && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-white/25">
              <MicOff size={12} />
              <span>Voice unavailable — use text input</span>
            </div>
          )}
        </div>

        {/* ── Transcript Area ── */}
        <div className="h-[42%] min-h-[200px] flex flex-col border-t border-white/[0.06]">
          {/* Status bar */}
          <div className="px-5 py-2 flex items-center justify-between border-b border-white/[0.04]">
            <span className="text-[11px] font-semibold text-white/20 uppercase tracking-widest">
              Transcript
            </span>
            <div className="flex items-center gap-3">
              {isHandsFreeMode && (
                <StatusDot color="green" label="Hands-free" />
              )}
              {isListening && (
                <StatusDot color="yellow" label="Listening" />
              )}
              {isRecording && !isHandsFreeMode && (
                <StatusDot color="red" label="Recording" />
              )}
              {isTranscribing && (
                <StatusDot color="amber" label="Transcribing" />
              )}
              {isThinking && (
                <StatusDot color="purple" label="Generating" />
              )}
              {isSpeaking && (
                <StatusDot color="yellow" label="Speaking" />
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {visibleMessages.length === 0 && !isThinking && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-white/15">
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
                <div className="bg-lemonade-accent/5 border border-lemonade-accent/10 rounded-2xl rounded-br-md px-4 py-2.5">
                  <p className="text-sm text-lemonade-accent/60 italic">
                    {transcriptionDelta}
                  </p>
                </div>
              </div>
            )}

            {/* Transcribing indicator */}
            {isTranscribing && !transcriptionDelta && (
              <div className="flex justify-end">
                <div className="bg-lemonade-accent/10 border border-lemonade-accent/20 rounded-2xl rounded-br-md px-4 py-2.5 flex items-center gap-2">
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
                  <span className="text-xs text-lemonade-accent/70">
                    Processing speech...
                  </span>
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-white/[0.04] rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-white/30">Thinking...</span>
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
              className="px-4 py-2.5 border-t border-white/[0.04] flex items-center gap-2"
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isSending}
                className="flex-1 px-4 py-2 text-sm bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/90 placeholder-white/20 focus:outline-none focus:border-lemonade-accent/30 focus:ring-1 focus:ring-lemonade-accent/20 disabled:opacity-40 transition-colors"
              />
              <button
                type="submit"
                disabled={isSending || !textInput.trim()}
                className="p-2 bg-lemonade-accent text-[#141413] rounded-xl hover:bg-lemonade-accent-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
    <span className="flex items-center gap-1.5 text-[10px] font-medium text-white/30 uppercase tracking-wider">
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
      <div className={`max-w-[75%] min-w-[60px]`}>
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-lemonade-accent text-[#141413] rounded-2xl rounded-br-md'
              : 'bg-white/[0.05] text-white/85 rounded-2xl rounded-bl-md'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <p
          className={`text-[10px] text-white/15 mt-1 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {format(new Date(message.timestamp), 'h:mm a')}
        </p>
      </div>
    </div>
  );
};

export default Interview;
