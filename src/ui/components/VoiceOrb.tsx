import React from 'react';

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isVADActive?: boolean;
  isTranscribing?: boolean;
  isThinking?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isListening,
  isSpeaking,
  audioLevel,
  isVADActive = false,
  isTranscribing = false,
  isThinking = false,
}) => {
  // Calculate scale based on audio level for dynamic effect
  const scale = 1 + Math.min(audioLevel, 1) * 0.5;

  // Determine the current state for rendering priority
  // Priority: speaking > transcribing > thinking > listening+VAD > listening > idle
  const getOrbState = () => {
    if (isSpeaking) return 'speaking';
    if (isTranscribing) return 'transcribing';
    if (isThinking) return 'thinking';
    if (isListening && isVADActive) return 'speech-detected';
    if (isListening) return 'listening';
    return 'idle';
  };

  const orbState = getOrbState();

  const orbStyles: Record<string, { bg: string; glow: string; text: string; label: string }> = {
    idle: {
      bg: 'bg-gradient-to-br from-gray-300 to-gray-400',
      glow: '',
      text: 'text-gray-500',
      label: 'Ready',
    },
    listening: {
      bg: 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-300/50',
      glow: 'bg-red-400',
      text: 'text-red-600',
      label: 'Listening...',
    },
    'speech-detected': {
      bg: 'bg-gradient-to-br from-green-400 to-green-600 shadow-green-300/50',
      glow: 'bg-green-400',
      text: 'text-green-600',
      label: 'Speech detected',
    },
    transcribing: {
      bg: 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-300/50',
      glow: 'bg-blue-400',
      text: 'text-blue-600',
      label: 'Transcribing...',
    },
    thinking: {
      bg: 'bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-300/50',
      glow: 'bg-purple-400',
      text: 'text-purple-600',
      label: 'AI is thinking...',
    },
    speaking: {
      bg: 'bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-300/50',
      glow: 'bg-yellow-400',
      text: 'text-yellow-600',
      label: 'Speaking...',
    },
  };

  const style = orbStyles[orbState];

  return (
    <div className="relative flex flex-col items-center justify-center w-64 h-64">
      {/* Outer Glow / Ripple */}
      {style.glow && (
        <div
          className={`absolute inset-0 rounded-full opacity-20 animate-ping ${style.glow}`}
        />
      )}

      {/* Secondary ring for transcribing / thinking */}
      {(orbState === 'transcribing' || orbState === 'thinking') && (
        <div
          className={`absolute inset-4 rounded-full border-4 opacity-50 animate-spin ${
            orbState === 'transcribing'
              ? 'border-blue-300 border-t-blue-600'
              : 'border-purple-300 border-t-purple-600'
          }`}
          style={{ animationDuration: '1.5s' }}
        />
      )}

      {/* VAD Active Indicator — green ring when speech is detected while listening */}
      {orbState === 'speech-detected' && (
        <div className="absolute inset-2 rounded-full border-4 border-green-400 opacity-70 animate-pulse z-20" />
      )}

      {/* Main Orb */}
      <div
        className={`relative z-10 w-32 h-32 rounded-full shadow-lg transition-all duration-150 flex items-center justify-center ${style.bg}`}
        style={{
          transform: `scale(${
            orbState === 'listening' || orbState === 'speech-detected' || orbState === 'speaking'
              ? scale
              : orbState === 'transcribing' || orbState === 'thinking'
              ? 1.05
              : 1
          })`,
        }}
      >
        {/* Inner Core */}
        <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          {/* Transcribing wave animation */}
          {orbState === 'transcribing' && (
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-1 bg-white/80 rounded-full animate-pulse"
                  style={{
                    height: `${12 + Math.sin(Date.now() / 200 + i) * 8}px`,
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: '0.6s',
                  }}
                />
              ))}
            </div>
          )}

          {/* Thinking dots animation */}
          {orbState === 'thinking' && (
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 bg-white/80 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status Text */}
      <div className="absolute -bottom-14 text-center">
        <p className={`text-lg font-medium transition-colors duration-300 ${style.text}`}>
          {style.label}
        </p>

        {/* Audio level indicator for listening states */}
        {(orbState === 'listening' || orbState === 'speech-detected') && (
          <div className="mt-2 flex items-center justify-center gap-1">
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-100 ${
                  audioLevel > 0.7 ? 'bg-red-500' : audioLevel > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(audioLevel * 100, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-400 w-8 text-right">
              {Math.round(audioLevel * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
