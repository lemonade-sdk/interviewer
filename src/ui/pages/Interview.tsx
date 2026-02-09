import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { StopCircle, Settings, FileText, Mic, Volume2, VolumeX, Send } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Message, AgentPersona, AudioSettings as AudioSettingsType } from '../../types';
import { format } from 'date-fns';
import { PersonaSelector } from '../components/PersonaSelector';
import { AudioSettings } from '../components/AudioSettings';
import { VoiceOrb } from '../components/VoiceOrb';
import { VoiceInterviewManager } from '../../services/VoiceInterviewManager';

type InterviewStage = 'selection' | 'interview';

const Interview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentInterview, setCurrentInterview } = useStore();

  // Voice capability passed from Preparing page (ASR + TTS both loaded)
  const voiceEnabled = (location.state as any)?.voiceEnabled ?? true;
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [textInput, setTextInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Stage Management
  const [stage, setStage] = useState<InterviewStage>('selection');
  const [isLoaded, setIsLoaded] = useState(false);

  // Voice features state
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<AgentPersona | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isVADActive, setIsVADActive] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  
  // Voice manager instance
  const voiceManagerRef = useRef<VoiceInterviewManager | null>(null);

  useEffect(() => {
    if (id) {
      loadInterview();
      loadDefaultPersona();
      if (voiceEnabled) {
        initializeVoiceManager();
      } else {
        console.warn('Voice features disabled (ASR/TTS models not loaded). Text-only interview mode.');
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.cleanup();
        voiceManagerRef.current = null;
      }
    };
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTranscribing, isThinking]);

  // Auto-save transcript on every message change
  useEffect(() => {
    if (id && messages.length > 0 && currentInterview) {
      // Debounce to avoid excessive saves
      const timeoutId = setTimeout(() => {
        saveTranscript();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, id]);

  // Transition logic
  useEffect(() => {
    // When voice is disabled, don't wait for voiceManagerRef — go straight to interview
    const voiceReady = voiceEnabled ? !!voiceManagerRef.current : true;
    if (currentInterview && voiceReady && !isLoaded) {
      const timer = setTimeout(() => {
        setIsLoaded(true);
        setStage('interview');
        // Auto-enable voice mode only when ASR+TTS are available
        setVoiceMode(voiceEnabled);
      }, voiceEnabled ? 3000 : 1000);
      return () => clearTimeout(timer);
    }
  }, [currentInterview, isLoaded, voiceEnabled]);

  const saveTranscript = async () => {
    if (!id || messages.length === 0) return;
    try {
      await window.electronAPI.updateInterviewTranscript(id, messages);
      console.log('Transcript auto-saved');
    } catch (error) {
      console.error('Failed to auto-save transcript:', error);
    }
  };

  const loadDefaultPersona = async () => {
    try {
      const defaultPersona = await window.electronAPI.getDefaultPersona();
      if (defaultPersona) {
        setSelectedPersona(defaultPersona);
      } else {
        setShowPersonaSelector(true);
      }
    } catch (error) {
      console.error('Failed to load default persona:', error);
      setShowPersonaSelector(true);
    }
  };

  const initializeVoiceManager = async () => {
    try {
      // Get default audio settings
      const defaultAudioSettings: AudioSettingsType = {
        inputVolume: 100,
        outputVolume: 100,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      // Read ASR model from interviewer settings (set by Preparing page)
      let asrModel: 'Whisper-Tiny' | 'Whisper-Base' | 'Whisper-Small' = 'Whisper-Base';
      try {
        const settings = await window.electronAPI.getInterviewerSettings();
        if (settings?.asrModel) {
          // Validate the model name matches one of the allowed whisper models
          const validModels = ['Whisper-Tiny', 'Whisper-Base', 'Whisper-Small'];
          if (validModels.includes(settings.asrModel)) {
            asrModel = settings.asrModel as typeof asrModel;
          }
        }
      } catch {
        console.warn('Could not read ASR model from settings, using default');
      }

      // Create voice manager instance
      const manager = new VoiceInterviewManager(
        defaultAudioSettings,
        'http://localhost:8000/api/v1', // ASR base URL
        asrModel
      );

      // Set up event listeners
      manager.on('recording-started', () => {
        setIsRecording(true);
        console.log('Recording started');
      });

      manager.on('recording-stopped', () => {
        setIsRecording(false);
        console.log('Recording stopped');
      });

      manager.on('audio-level', (level: number) => {
        setAudioLevel(level);
      });

      manager.on('speech-detected', () => {
        setIsVADActive(true);
        console.log('Speech detected');
      });

      manager.on('speech-ended', () => {
        setIsVADActive(false);
        console.log('Speech ended');
      });

      manager.on('transcription-started', () => {
        setIsTranscribing(true);
        console.log('Transcription started (Whisper processing...)');
      });

      manager.on('transcription-complete', async (text: string) => {
        setIsTranscribing(false);
        console.log('Transcription:', text);
        // Send transcribed text as message
        if (text.trim() && id) {
          await sendVoiceMessage(text);
        }
      });

      manager.on('speaking-started', () => {
        setIsSpeaking(true);
        console.log('TTS started');
      });

      manager.on('speaking-stopped', () => {
        setIsSpeaking(false);
        console.log('TTS stopped');
      });

      manager.on('error', (error: Error) => {
        console.error('Voice manager error:', error);
        alert(`Voice error: ${error.message}`);
      });

      // Initialize the manager
      await manager.initialize();
      voiceManagerRef.current = manager;
      
      console.log('Voice manager initialized');
    } catch (error) {
      console.error('Failed to initialize voice manager:', error);
    }
  };

  const loadInterview = async () => {
    if (!id) return;
    try {
      const interview = await window.electronAPI.getInterview(id);
      if (!interview) {
        throw new Error('Interview session not found in database.');
      }
      setCurrentInterview(interview);
      
      // Restore messages from database (handles page refresh)
      if (interview.transcript && interview.transcript.length > 0) {
        setMessages(interview.transcript);
        console.log(`Restored ${interview.transcript.length} messages from database`);
      }
    } catch (error: any) {
      console.error('Failed to load interview:', error);
      alert(`Error loading interview: ${error.message}`);
      navigate('/dashboard');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !id || isSending) return;

    setIsSending(true);
    await sendTextMessage(text);
    setIsSending(false);
  };

  const sendTextMessage = async (text: string) => {
    if (!id) return;

    // Add user message to UI immediately
    const tempUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      // Show "AI is thinking..." state
      setIsThinking(true);

      const response = await window.electronAPI.sendMessage(id, text);
      setIsThinking(false);
      setMessages(prev => [...prev, response]);
      
      // Auto-play TTS if voice mode is enabled
      if (voiceMode && voiceManagerRef.current && !isMuted) {
        try {
          await voiceManagerRef.current.speak(response.content);
        } catch (error) {
          console.error('TTS failed:', error);
        }
      }
      
      // Reload interview to get updated transcript
      await loadInterview();
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsThinking(false);
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

  const handleEndInterview = async () => {
    if (!id) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to end this interview? You will receive feedback on your performance.'
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

  const handleToggleRecording = async () => {
    if (!voiceMode || !voiceManagerRef.current) return;

    try {
      if (isRecording) {
        // Stop recording and get transcription
        await voiceManagerRef.current.stopVoiceInput();
      } else {
        // Start recording with VAD
        await voiceManagerRef.current.startVoiceInput({
          enableVAD: true,
          vadSensitivity: 0.7,
        });
      }
    } catch (error: any) {
      console.error('Recording toggle failed:', error);
      alert(`Failed to ${isRecording ? 'stop' : 'start'} recording: ${error.message}`);
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    if (voiceManagerRef.current && voiceManagerRef.current.getState().isSpeaking) {
      voiceManagerRef.current.stopSpeaking();
    }
  };

  if (!currentInterview) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading interview...</p>
        </div>
      </div>
    );
  }

  // --- SELECTION STAGE UI ---
  if (stage === 'selection') {
    return (
      <div className="flex h-full bg-white">
        {/* Left Side: Resume */}
        <div className="w-1/2 bg-gray-50 border-r border-gray-200 p-8 flex flex-col items-center justify-center">
          <div className="w-3/4 aspect-[3/4] bg-white shadow-xl rounded-lg border border-gray-200 flex flex-col items-center justify-center text-gray-400">
            <FileText size={64} className="mb-4" />
            <span className="text-lg font-medium">Resume Preview</span>
            <span className="text-sm mt-2">Loading document...</span>
          </div>
        </div>

        {/* Right Side: Preparation Text */}
        <div className="w-1/2 flex flex-col items-center justify-center p-12 bg-white">
          <h2 className="text-4xl font-bold text-gray-900 mb-6 text-center leading-tight">
            prepare for your<br />interview
          </h2>
          <div className="flex items-center gap-3 text-primary-600 mt-8">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
            <span className="font-medium">Starting Interview Process...</span>
          </div>
        </div>
      </div>
    );
  }

  // --- VOICE UI STAGE ---
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Persona Selector Modal */}
      {showPersonaSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <PersonaSelector
              selectedPersonaId={selectedPersona?.id}
              onSelect={handlePersonaSelect}
              onClose={() => setShowPersonaSelector(false)}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{currentInterview.title}</h1>
            <p className="text-gray-600 mt-1">
              {currentInterview.company} • {currentInterview.position}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Audio Settings Button */}
            <button
              onClick={() => setShowAudioSettings(!showAudioSettings)}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Audio Settings"
            >
              <Settings size={20} />
            </button>

            {/* End Interview Button */}
            <button
              onClick={handleEndInterview}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <StopCircle size={20} />
              End Interview
            </button>
          </div>
        </div>

        {/* Audio Settings Panel */}
        {showAudioSettings && (
          <div className="mt-4">
            <AudioSettings />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Voice Orb Area - Centered */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] bg-gradient-to-b from-white to-gray-50">
          <VoiceOrb 
            isListening={isRecording} 
            isSpeaking={isSpeaking} 
            audioLevel={audioLevel}
            isVADActive={isVADActive}
            isTranscribing={isTranscribing}
            isThinking={isThinking}
          />
          
          {/* Voice Controls (Simplified) */}
          <div className="mt-12 flex items-center gap-6">
             <button
              onClick={handleToggleRecording}
              className={`p-4 rounded-full transition-all duration-200 shadow-md ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {isRecording ? <StopCircle size={32} /> : <Mic size={32} />}
            </button>
            <button
              onClick={handleToggleMute}
              className={`p-4 rounded-full transition-all duration-200 shadow-md ${
                isMuted ? 'bg-gray-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
          </div>
        </div>

        {/* Transcript Area - Bottom */}
        <div className="h-1/3 border-t border-gray-200 bg-white flex flex-col">
          <div className="px-6 py-2 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live Transcript</h3>
            <div className="flex items-center gap-3">
              {isRecording && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Recording
                </span>
              )}
              {isTranscribing && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Whisper ASR
                </span>
              )}
              {isSpeaking && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-600 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                  TTS Playing
                </span>
              )}
              {isThinking && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                  Generating
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.filter(m => m.role !== 'system').map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Transcribing indicator */}
            {isTranscribing && (
              <div className="flex justify-end">
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="w-0.5 bg-blue-400 rounded-full animate-pulse"
                        style={{
                          height: `${8 + i * 3}px`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: '0.5s',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-blue-600 font-medium">Transcribing speech...</span>
                </div>
              </div>
            )}

            {/* AI thinking indicator */}
            {isThinking && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">AI is thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
          {/* Text Input Fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (textInput.trim()) {
                handleSendMessage(textInput);
                setTextInput('');
              }
            }}
            className="px-4 py-3 border-t border-gray-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message..."
              disabled={isSending}
              className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSending || !textInput.trim()}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-2xl ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <p className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {format(new Date(message.timestamp), 'h:mm a')}
        </p>
      </div>
    </div>
  );
};

export default Interview;
