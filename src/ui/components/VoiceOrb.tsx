import React from 'react';

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ isListening, isSpeaking, audioLevel }) => {
  // Calculate scale based on audio level for dynamic effect
  const scale = 1 + Math.min(audioLevel, 1) * 0.5;
  
  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Outer Glow / Ripple */}
      {(isListening || isSpeaking) && (
        <div 
          className={`absolute inset-0 rounded-full opacity-30 animate-ping ${
            isSpeaking ? 'bg-yellow-400' : 'bg-red-400'
          }`}
        />
      )}
      
      {/* Main Orb */}
      <div 
        className={`relative z-10 w-32 h-32 rounded-full shadow-lg transition-all duration-100 flex items-center justify-center ${
          isSpeaking 
            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-300/50' 
            : isListening 
              ? 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-300/50'
              : 'bg-gradient-to-br from-gray-300 to-gray-400'
        }`}
        style={{ 
          transform: `scale(${isListening || isSpeaking ? scale : 1})`,
        }}
      >
        {/* Inner Core */}
        <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm" />
      </div>

      {/* Status Text */}
      <div className="absolute -bottom-12 text-center">
        <p className={`text-lg font-medium transition-colors ${
          isSpeaking ? 'text-yellow-600' : isListening ? 'text-red-600' : 'text-gray-500'
        }`}>
          {isSpeaking ? 'Speaking...' : isListening ? 'Listening...' : 'Idle'}
        </p>
      </div>
    </div>
  );
};
