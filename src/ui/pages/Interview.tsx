import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, StopCircle, Settings, User } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Message, AgentPersona, AudioSettings as AudioSettingsType } from '../../types';
import { format } from 'date-fns';
import { VoiceControls } from '../components/VoiceControls';
import { PersonaSelector } from '../components/PersonaSelector';
import { AudioSettings } from '../components/AudioSettings';
import { VoiceInterviewManager } from '../../services/VoiceInterviewManager';

const Interview: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentInterview, setCurrentInterview } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice features state
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<AgentPersona | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
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
      initializeVoiceManager();
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
  }, [messages]);

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

      // Create voice manager instance
      const manager = new VoiceInterviewManager(
        defaultAudioSettings,
        'http://localhost:8000/api/v1', // ASR base URL
        'Whisper-Base' // ASR model
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

      manager.on('transcription-complete', async (text: string) => {
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
      setCurrentInterview(interview);
      
      // Restore messages from database (handles page refresh)
      if (interview.transcript && interview.transcript.length > 0) {
        setMessages(interview.transcript);
        console.log(`Restored ${interview.transcript.length} messages from database`);
      }
    } catch (error) {
      console.error('Failed to load interview:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !id || isSending) return;

    setIsSending(true);
    const userMessage = inputMessage;
    setInputMessage('');

    await sendTextMessage(userMessage);
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
      const response = await window.electronAPI.sendMessage(id, text);
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

  const handleToggleVoiceMode = () => {
    setVoiceMode(!voiceMode);
    if (!voiceMode) {
      // Entering voice mode - ensure persona is selected
      if (!selectedPersona) {
        setShowPersonaSelector(true);
      }
    } else {
      // Exiting voice mode - stop recording
      setIsRecording(false);
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
              {currentInterview.company} • {currentInterview.position} •{' '}
              <span className="capitalize">{currentInterview.interviewType}</span>
            </p>
            {selectedPersona && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <User size={16} />
                <span>Interviewer: <strong>{selectedPersona.name}</strong></span>
                <button
                  onClick={() => setShowPersonaSelector(true)}
                  className="text-primary-600 hover:text-primary-700 underline"
                >
                  Change
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Voice Mode Toggle */}
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={voiceMode}
                onChange={handleToggleVoiceMode}
                className="w-4 h-4 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Voice Mode</span>
            </label>

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

        {/* Voice Controls */}
        {voiceMode && (
          <div className="mt-4">
            <VoiceControls
              isRecording={isRecording}
              isSpeaking={isSpeaking}
              isMuted={isMuted}
              audioLevel={audioLevel}
              isVADActive={isVADActive}
              onToggleRecording={handleToggleRecording}
              onToggleMute={handleToggleMute}
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.filter(m => m.role !== 'system').map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input (only show when not in voice mode) */}
      {!voiceMode && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type your response..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={isSending}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send size={20} />
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
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
