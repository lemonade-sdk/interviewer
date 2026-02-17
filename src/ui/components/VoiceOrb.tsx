import React, { useEffect, useRef } from 'react';
import { Mic, Square } from 'lucide-react';

interface VoiceOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  isVADActive?: boolean;
  isTranscribing?: boolean;
  isThinking?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  isListening,
  isSpeaking,
  audioLevel,
  isVADActive = false,
  isTranscribing = false,
  isThinking = false,
  onClick,
  disabled = false,
}) => {
  const animFrameRef = useRef<number>(0);
  const barsRef = useRef<HTMLDivElement>(null);

  // Determine visual state (priority order)
  const getState = (): 'speaking' | 'processing' | 'active' | 'listening' | 'idle' => {
    if (isSpeaking) return 'speaking';
    if (isTranscribing || isThinking) return 'processing';
    if (isListening && isVADActive) return 'active';
    if (isListening) return 'listening';
    return 'idle';
  };

  const state = getState();
  const isActive = state !== 'idle';

  // Audio-reactive scale
  const level = Math.min(audioLevel, 1);
  const orbScale =
    state === 'listening' || state === 'active'
      ? 1 + level * 0.2
      : state === 'speaking'
      ? 1 + level * 0.15
      : 1;

  // Glow intensity
  const glowOpacity = isActive ? 0.25 + level * 0.15 : 0.08;
  const glowSpread = isActive ? 50 + level * 30 : 25;

  // Animate processing bars
  useEffect(() => {
    if (state !== 'processing' || !barsRef.current) return;
    let frame = 0;
    const animate = () => {
      if (!barsRef.current) return;
      const bars = barsRef.current.children;
      for (let i = 0; i < bars.length; i++) {
        const h = 10 + Math.sin(frame * 0.08 + i * 1.2) * 8;
        (bars[i] as HTMLElement).style.height = `${h}px`;
      }
      frame++;
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [state]);

  const statusLabel = {
    idle: 'Tap to speak',
    listening: 'Listening...',
    active: 'Hearing you...',
    processing: isTranscribing ? 'Transcribing...' : 'Thinking...',
    speaking: 'Speaking...',
  }[state];

  return (
    <div className="relative flex flex-col items-center select-none">
      <button
        onClick={onClick}
        disabled={disabled}
        className="relative group cursor-pointer focus:outline-none disabled:cursor-not-allowed"
        aria-label={isListening ? 'Stop recording' : 'Start recording'}
      >
        {/* Ambient glow */}
        <div
          className="absolute rounded-full transition-all duration-700 pointer-events-none"
          style={{
            inset: '-40px',
            background: `radial-gradient(circle, rgba(255,215,68,${glowOpacity}) 0%, transparent 70%)`,
          }}
        />

        {/* Ripple ring — listening / speaking */}
        {(state === 'listening' || state === 'active' || state === 'speaking') && (
          <div
            className="absolute rounded-full border border-lemonade-accent/25 pointer-events-none"
            style={{
              inset: '-16px',
              animation: 'orbPing 2s cubic-bezier(0,0,0.2,1) infinite',
            }}
          />
        )}

        {/* Second ripple — speaking only */}
        {state === 'speaking' && (
          <div
            className="absolute rounded-full border border-lemonade-accent/15 pointer-events-none"
            style={{
              inset: '-28px',
              animation: 'orbPing 2.5s cubic-bezier(0,0,0.2,1) infinite 0.4s',
            }}
          />
        )}

        {/* Spin ring — processing */}
        {state === 'processing' && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: '-10px',
              border: '2px solid transparent',
              borderTopColor: 'rgba(255,215,68,0.5)',
              borderRightColor: 'rgba(255,215,68,0.2)',
              animation: 'spin 1.5s linear infinite',
            }}
          />
        )}

        {/* Main orb */}
        <div
          className="relative w-36 h-36 rounded-full transition-transform duration-150 ease-out"
          style={{ transform: `scale(${orbScale})` }}
        >
          {/* Gradient fill */}
          <div
            className="absolute inset-0 rounded-full transition-all duration-500"
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #FFD744 0%, #E5A800 50%, #FFD744 100%)'
                : 'linear-gradient(135deg, rgba(255,215,68,0.5) 0%, rgba(229,152,0,0.35) 100%)',
              boxShadow: `0 0 ${glowSpread}px rgba(255,215,68,${glowOpacity})`,
            }}
          />

          {/* Highlight */}
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <div
              className="absolute rounded-full bg-white/15 blur-xl"
              style={{ top: '-20%', left: '-15%', width: '65%', height: '65%' }}
            />
          </div>

          {/* Center content */}
          <div className="absolute inset-0 flex items-center justify-center">
            {state === 'processing' ? (
              <div ref={barsRef} className="flex items-end gap-[3px]">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-full bg-black/35"
                    style={{ height: '10px', transition: 'height 80ms ease' }}
                  />
                ))}
              </div>
            ) : isListening ? (
              <Square className="w-6 h-6 text-black/40" fill="currentColor" />
            ) : (
              <Mic
                className="w-7 h-7 text-black/30 group-hover:text-black/50 transition-colors duration-200"
              />
            )}
          </div>
        </div>
      </button>

      {/* Status label */}
      <p className="mt-8 text-[13px] font-medium tracking-wide text-gray-400 dark:text-white/40 transition-colors duration-300">
        {statusLabel}
      </p>
    </div>
  );
};
